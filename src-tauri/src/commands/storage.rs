//! User-selectable storage location for session recordings.
//!
//! By default recordings live under `<app-data>/<configured-app-id>/sessions/`. The
//! user can point them at any writable directory (an external drive, a synced
//! folder) from Settings → Storage; the choice persists as `recordingsRoot` in
//! tauri-plugin-store's `settings.json`, which is also where the frontend
//! writes it.
//!
//! Only recordings are relocatable. The image library (`images.rs`), brand
//! assets (`assets.rs`) and `manna.db` stay under app data — the DB in
//! particular opens before the store is readable, so it has no chance to honor
//! a custom root.
//!
//! Sessions record an absolute `audio_path`, so recordings left behind in an
//! old root keep playing back after a change. `move_recordings_root` copies the
//! tree over and rewrites those rows for users who'd rather bring them along.

use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::{Mutex, MutexGuard};

use tauri::{AppHandle, State};
use tauri_plugin_store::StoreExt;

use rhema_notes::SessionDb;

use crate::state::AppState;

/// Reject a root change while audio is being captured.
///
/// Segments are written to the directory resolved at `start_transcription`,
/// but `finalize_session_audio` concatenates from the directory resolved at
/// End Session. Moving the root in between would leave finalize looking in an
/// empty folder and silently drop the service's recording.
fn ensure_not_recording(state: &Mutex<AppState>) -> Result<MutexGuard<'_, AppState>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    if state.stt_active.load(Ordering::SeqCst)
        || state.audio_active.load(Ordering::SeqCst)
        || state.stt_stopping
        || state
            .capture_thread
            .as_ref()
            .is_some_and(|thread| !thread.is_finished())
    {
        return Err("Stop the current session before changing the recording folder.".into());
    }
    // Hold this guard through the operation so capture cannot start during a move.
    Ok(state)
}

/// Directory holding all per-session recording folders, absent any override.
pub fn default_recordings_root(app: &AppHandle) -> PathBuf {
    recordings_root_for_identifier(&app.config().identifier)
}

fn recordings_root_for_identifier(identifier: &str) -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(identifier)
        .join("sessions")
}

/// Read the user's custom recordings root from `settings.json`, if set.
///
/// A blank or whitespace-only value is treated as unset so a cleared field in
/// the store can't redirect recordings to the process working directory.
fn stored_recordings_root(app: &AppHandle) -> Option<PathBuf> {
    let store = app.store("settings.json").ok()?;
    let value = store.get("recordingsRoot")?;
    let path = value.as_str()?.trim().to_string();
    (!path.is_empty()).then(|| PathBuf::from(path))
}

/// Directory holding all per-session recording folders, honoring the user's
/// choice. Falls back to the default root when no override is set.
pub fn recordings_root(app: &AppHandle) -> PathBuf {
    stored_recordings_root(app).unwrap_or_else(|| default_recordings_root(app))
}

/// Directory for one session's recording segments and final `audio.mp3`.
pub fn session_dir(app: &AppHandle, session_id: i64) -> PathBuf {
    recordings_root(app).join(session_id.to_string())
}

/// Resumed and unfinished recordings keep their existing folder after a root change.
pub fn recording_dir(default_dir: PathBuf, audio_path: Option<&str>) -> PathBuf {
    audio_path
        .and_then(|path| Path::new(path).parent())
        .filter(|path| path.is_absolute())
        .map(Path::to_path_buf)
        .unwrap_or(default_dir)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingsLocation {
    /// The directory currently in use.
    pub path: String,
    /// The built-in app-data location, shown as the "Default" choice.
    pub default_path: String,
    /// False when the user has pointed recordings elsewhere.
    pub is_default: bool,
}

/// Report where recordings are being written, for the Storage settings panel.
#[tauri::command]
pub fn get_recordings_location(app: AppHandle) -> RecordingsLocation {
    let default_path = default_recordings_root(&app);
    let path = recordings_root(&app);
    RecordingsLocation {
        is_default: path == default_path,
        path: path.to_string_lossy().into_owned(),
        default_path: default_path.to_string_lossy().into_owned(),
    }
}

/// Reject a candidate root that we can't actually record into, so the failure
/// surfaces at pick time rather than silently at the start of a service.
///
/// Writability is probed with a real temp file: `create_dir_all` succeeding
/// says nothing about a read-only mount or a permission-gated folder.
fn validate_root(root: &Path) -> Result<(), String> {
    if root.is_relative() {
        return Err("Choose an absolute path for the recordings folder.".into());
    }
    if root.is_file() {
        return Err(format!("{} is a file, not a folder.", root.display()));
    }
    std::fs::create_dir_all(root).map_err(|e| format!("Can't create {}: {e}", root.display()))?;

    let probe = root.join(".manna-write-test");
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe)
        .map_err(|e| format!("Can't write to {}: {e}", root.display()))?;
    let _ = std::fs::remove_file(&probe);
    Ok(())
}

/// Point future recordings at `path` (or back at the default when `None`).
///
/// Existing recordings stay where they are and keep playing back — their
/// absolute paths are stored per session. Call `move_recordings_root` first to
/// bring them along. Rejected while a session is recording.
#[tauri::command]
pub fn set_recordings_root(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    path: Option<String>,
) -> Result<RecordingsLocation, String> {
    let _idle = ensure_not_recording(&state)?;

    let trimmed = path.map(|p| p.trim().to_string()).filter(|p| !p.is_empty());
    let store = app.store("settings.json").map_err(|e| e.to_string())?;

    if let Some(p) = &trimmed {
        let root = PathBuf::from(p);
        validate_root(&root)?;
        store.set("recordingsRoot", serde_json::json!(root.to_string_lossy()));
        log::info!("[storage] recordings root set to {}", root.display());
    } else {
        store.delete("recordingsRoot");
        log::info!("[storage] recordings root reset to default");
    }
    store.save().map_err(|e| e.to_string())?;

    Ok(get_recordings_location(app))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveOutcome {
    /// Number of session folders copied to the new root.
    pub moved: usize,
    /// Session folders left behind because they failed to copy.
    pub failed: Vec<String>,
}

/// Recursively copy `src` into `dst`, creating `dst` as needed.
fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        let kind = entry.file_type()?;
        if kind.is_symlink() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Recording folders cannot contain symbolic links.",
            ));
        }
        if kind.is_dir() {
            copy_dir(&from, &to)?;
        } else {
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

/// Copy every existing session recording folder into `dest`, rewrite the
/// affected `audio_path` rows, then delete the originals.
///
/// Copy-then-delete rather than rename: the new root is often on a different
/// filesystem (external drive), where `rename` fails outright. Each session
/// folder is handled independently — one unreadable folder is reported in
/// `failed` and leaves the rest of the move intact, and a folder is only
/// deleted from the old root after its copy and DB update both succeed, so a
/// failure mid-way never destroys the sole copy of a recording.
///
/// Does not itself change the configured root; call `set_recordings_root`
/// after this succeeds.
#[tauri::command]
pub fn move_recordings_root(
    app: AppHandle,
    state: State<'_, Mutex<AppState>>,
    db: State<'_, Mutex<SessionDb>>,
    dest: String,
) -> Result<MoveOutcome, String> {
    let _idle = ensure_not_recording(&state)?;
    let db = db.lock().map_err(|e| e.to_string())?;
    move_recordings(&recordings_root(&app), Path::new(dest.trim()), &db)
}

/// Path/DB core of `move_recordings_root`, free of Tauri state so it can be
/// driven directly by tests.
fn move_recordings(
    src_root: &Path,
    dest_root: &Path,
    db: &SessionDb,
) -> Result<MoveOutcome, String> {
    validate_root(dest_root)?;

    let src_canon = src_root
        .canonicalize()
        .unwrap_or_else(|_| src_root.to_path_buf());
    let dest_canon = dest_root
        .canonicalize()
        .unwrap_or_else(|_| dest_root.to_path_buf());
    if src_canon == dest_canon {
        return Ok(MoveOutcome {
            moved: 0,
            failed: Vec::new(),
        });
    }
    if dest_canon.starts_with(&src_canon) {
        return Err("Choose a folder outside the current recordings folder.".into());
    }

    let entries = match std::fs::read_dir(src_root) {
        Ok(rd) => rd,
        // Nothing recorded yet — a move is trivially complete.
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Ok(MoveOutcome {
                moved: 0,
                failed: Vec::new(),
            })
        }
        Err(e) => return Err(format!("Can't read {}: {e}", src_root.display())),
    };

    let mut moved = 0_usize;
    let mut failed = Vec::new();

    for entry in entries.flatten() {
        let from = entry.path();
        if !from.is_dir() {
            continue;
        }
        // Session folders are named by session id; skip anything else.
        let Some(session_id) = from
            .file_name()
            .and_then(|n| n.to_str())
            .and_then(|n| n.parse::<i64>().ok())
        else {
            continue;
        };

        let session = match db.get_session(session_id) {
            Ok(session) => session,
            Err(_) => {
                failed.push(session_id.to_string());
                continue;
            }
        };
        let Some(old_audio) = session.audio_path.map(PathBuf::from) else {
            failed.push(session_id.to_string());
            continue;
        };
        if old_audio.parent().and_then(|path| path.canonicalize().ok()) != from.canonicalize().ok()
        {
            failed.push(session_id.to_string());
            continue;
        }
        let Some(filename) = old_audio.file_name() else {
            failed.push(session_id.to_string());
            continue;
        };
        let to = dest_root.join(session_id.to_string());
        // Claim a fresh destination. Never overwrite or remove an existing recording.
        if let Err(error) = std::fs::create_dir(&to) {
            log::warn!("[storage] cannot create {}: {error}", to.display());
            failed.push(session_id.to_string());
            continue;
        }
        if let Err(error) = copy_dir(&from, &to) {
            log::warn!("[storage] copy {} failed: {error}", from.display());
            let _ = std::fs::remove_dir_all(&to);
            failed.push(session_id.to_string());
            continue;
        }
        if let Err(error) =
            db.set_session_audio_path(session_id, &to.join(filename).to_string_lossy())
        {
            log::warn!("[storage] audio_path update for session {session_id} failed: {error}");
            let _ = std::fs::remove_dir_all(&to);
            failed.push(session_id.to_string());
            continue;
        }

        if let Err(e) = std::fs::remove_dir_all(&from) {
            // Copy and DB row are good; the stale original is cosmetic.
            log::warn!(
                "[storage] could not remove {} after move: {e}",
                from.display()
            );
        }
        moved += 1;
    }

    log::info!(
        "[storage] moved {moved} session folder(s) to {} ({} failed)",
        dest_root.display(),
        failed.len()
    );
    Ok(MoveOutcome { moved, failed })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn validate_root_rejects_relative_and_file_paths() {
        assert!(validate_root(Path::new("relative/dir")).is_err());

        let dir = tempdir().unwrap();
        let file = dir.path().join("a.txt");
        std::fs::write(&file, b"x").unwrap();
        assert!(validate_root(&file).is_err());
    }

    #[test]
    fn validate_root_creates_dir_and_leaves_no_probe_behind() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("new/nested/root");
        validate_root(&root).unwrap();
        assert!(root.is_dir());
        assert!(!root.join(".manna-write-test").exists());
    }

    /// Create a session with a recording at `<root>/<id>/audio.mp3`.
    fn seed_session(db: &SessionDb, root: &Path, title: &str, bytes: &[u8]) -> i64 {
        use rhema_notes::CreateSessionRequest;
        let session = db
            .create_session(&CreateSessionRequest {
                title: title.into(),
                title_is_automatic: false,
                speaker: None,
                date: "2026-07-15".into(),
                series_name: None,
                tags: vec![],
                planned_scriptures: vec![],
            })
            .unwrap();
        let dir = root.join(session.id.to_string());
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("audio.mp3"), bytes).unwrap();
        db.set_session_audio_path(session.id, dir.join("audio.mp3").to_str().unwrap())
            .unwrap();
        session.id
    }

    #[test]
    fn move_relocates_files_and_repoints_audio_paths() {
        let tmp = tempdir().unwrap();
        let db = SessionDb::open(&tmp.path().join("t.db")).unwrap();
        let src = tmp.path().join("old-root");
        let dest = tmp.path().join("new-root");
        std::fs::create_dir_all(&src).unwrap();

        let a = seed_session(&db, &src, "First", b"AAA");
        let b = seed_session(&db, &src, "Second", b"BBB");

        let outcome = move_recordings(&src, &dest, &db).unwrap();
        assert_eq!(outcome.moved, 2);
        assert!(outcome.failed.is_empty());

        // Bytes landed in the new root, originals are gone.
        assert_eq!(
            std::fs::read(dest.join(a.to_string()).join("audio.mp3")).unwrap(),
            b"AAA"
        );
        assert_eq!(
            std::fs::read(dest.join(b.to_string()).join("audio.mp3")).unwrap(),
            b"BBB"
        );
        assert!(!src.join(a.to_string()).exists());

        // Playback follows: DB now points at the new location.
        let reloaded = db.get_session(a).unwrap();
        assert_eq!(
            reloaded.audio_path,
            Some(
                dest.join(a.to_string()).join("audio.mp3")
                    .to_string_lossy()
                    .into_owned()
            )
        );
    }

    #[test]
    fn move_into_same_root_is_a_noop() {
        let tmp = tempdir().unwrap();
        let db = SessionDb::open(&tmp.path().join("t.db")).unwrap();
        let src = tmp.path().join("root");
        std::fs::create_dir_all(&src).unwrap();
        let id = seed_session(&db, &src, "Keep", b"AAA");

        let outcome = move_recordings(&src, &src, &db).unwrap();
        assert_eq!(outcome.moved, 0);
        // The recording survives an accidental move-onto-itself.
        assert_eq!(
            std::fs::read(src.join(format!("{id}/audio.mp3"))).unwrap(),
            b"AAA"
        );
    }

    #[test]
    fn move_rejects_destination_nested_in_source() {
        let tmp = tempdir().unwrap();
        let db = SessionDb::open(&tmp.path().join("t.db")).unwrap();
        let src = tmp.path().join("root");
        std::fs::create_dir_all(&src).unwrap();

        assert!(move_recordings(&src, &src.join("inner"), &db).is_err());
    }

    #[test]
    fn move_ignores_non_session_entries() {
        let tmp = tempdir().unwrap();
        let db = SessionDb::open(&tmp.path().join("t.db")).unwrap();
        let src = tmp.path().join("old");
        let dest = tmp.path().join("new");
        std::fs::create_dir_all(src.join("not-a-session")).unwrap();
        std::fs::write(src.join("stray.txt"), b"x").unwrap();

        let outcome = move_recordings(&src, &dest, &db).unwrap();
        assert_eq!(outcome.moved, 0);
        assert!(!dest.join("not-a-session").exists());
    }

    #[test]
    fn copy_dir_copies_nested_contents() {
        let dir = tempdir().unwrap();
        let src = dir.path().join("src");
        std::fs::create_dir_all(src.join("inner")).unwrap();
        std::fs::write(src.join("audio.mp3"), b"AAA").unwrap();
        std::fs::write(src.join("inner/seg.mp3"), b"BBB").unwrap();

        let dst = dir.path().join("dst");
        copy_dir(&src, &dst).unwrap();

        assert_eq!(std::fs::read(dst.join("audio.mp3")).unwrap(), b"AAA");
        assert_eq!(std::fs::read(dst.join("inner/seg.mp3")).unwrap(), b"BBB");
        // Source is untouched — the caller deletes it only after a good copy.
        assert!(src.join("audio.mp3").is_file());
    }
    #[test]
    fn move_never_overwrites_an_existing_destination_recording() {
        let tmp = tempdir().unwrap();
        let db = SessionDb::open(&tmp.path().join("t.db")).unwrap();
        let src = tmp.path().join("old");
        let dest = tmp.path().join("new");
        let id = seed_session(&db, &src, "Keep both", b"SOURCE");
        let target = dest.join(id.to_string());
        std::fs::create_dir_all(&target).unwrap();
        std::fs::write(target.join("audio.mp3"), b"DESTINATION").unwrap();
        let previous = db.get_session(id).unwrap().audio_path;
        let outcome = move_recordings(&src, &dest, &db).unwrap();
        assert_eq!(outcome.moved, 0);
        assert_eq!(outcome.failed, vec![id.to_string()]);
        assert_eq!(
            std::fs::read(target.join("audio.mp3")).unwrap(),
            b"DESTINATION"
        );
        assert_eq!(
            std::fs::read(src.join(format!("{id}/audio.mp3"))).unwrap(),
            b"SOURCE"
        );
        assert_eq!(db.get_session(id).unwrap().audio_path, previous);
    }

    #[test]
    fn move_does_not_repoint_a_session_recorded_in_another_root() {
        let tmp = tempdir().unwrap();
        let db = SessionDb::open(&tmp.path().join("t.db")).unwrap();
        let src = tmp.path().join("old");
        let dest = tmp.path().join("new");
        let id = seed_session(&db, &src, "Elsewhere", b"STALE");
        let real = tmp.path().join("other/audio.mp3");
        std::fs::create_dir_all(real.parent().unwrap()).unwrap();
        std::fs::write(&real, b"CURRENT").unwrap();
        db.set_session_audio_path(id, real.to_str().unwrap())
            .unwrap();
        let outcome = move_recordings(&src, &dest, &db).unwrap();
        assert_eq!(outcome.moved, 0);
        assert_eq!(
            db.get_session(id).unwrap().audio_path.as_deref(),
            real.to_str()
        );
        assert_eq!(std::fs::read(&real).unwrap(), b"CURRENT");
        assert!(src.join(id.to_string()).exists());
    }

    #[test]
    fn folder_validation_never_truncates_an_existing_probe_file() {
        let tmp = tempdir().unwrap();
        let probe = tmp.path().join(".manna-write-test");
        std::fs::write(&probe, b"KEEP").unwrap();
        assert!(validate_root(tmp.path()).is_err());
        assert_eq!(std::fs::read(probe).unwrap(), b"KEEP");
    }

    #[test]
    fn resumed_recordings_keep_their_original_folder() {
        let tmp = tempdir().unwrap();
        let old = tmp.path().join("old/7");
        let new = tmp.path().join("new/7");
        assert_eq!(
            recording_dir(new.clone(), old.join("audio.mp3").to_str()),
            old
        );
        assert_eq!(recording_dir(new.clone(), None), new);
    }

    #[test]
    fn storage_changes_are_blocked_until_capture_has_fully_stopped() {
        let state = Mutex::new(AppState::new());
        state.lock().unwrap().stt_stopping = true;
        assert!(ensure_not_recording(&state).is_err());
        state.lock().unwrap().stt_stopping = false;
        let (tx, rx) = std::sync::mpsc::channel();
        state.lock().unwrap().capture_thread = Some(std::thread::spawn(move || {
            let _ = rx.recv();
        }));
        assert!(ensure_not_recording(&state).is_err());
        tx.send(()).unwrap();
        state
            .lock()
            .unwrap()
            .capture_thread
            .take()
            .unwrap()
            .join()
            .unwrap();
        assert!(ensure_not_recording(&state).is_ok());
    }

    #[test]
    fn default_recordings_are_isolated_by_application_identity() {
        let production = recordings_root_for_identifier("com.soteria.app");
        let preview = recordings_root_for_identifier("com.soteria.internal");
        let upstream = recordings_root_for_identifier("com.manna.app");
        assert_ne!(production, preview);
        assert_ne!(production, upstream);
        assert!(production.ends_with("com.soteria.app/sessions"));
    }

}
