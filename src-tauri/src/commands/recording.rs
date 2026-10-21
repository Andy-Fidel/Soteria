pub(crate) mod timeline;

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use timeline::{part_from_file, Timeline};

use tauri::ipc::Response;
use tauri::{AppHandle, State};

use rhema_notes::SessionDb;

use super::storage::{recording_dir, session_dir};

/// List `audio-seg-*.mp3` segment files in `dir`, sorted chronologically
/// (filenames embed a zero-padded millisecond timestamp, so a lexical sort is
/// chronological).
fn list_segments(dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error),
    };
    let mut segments = Vec::new();
    for entry in entries {
        let path = entry?.path();
        if path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with("audio-seg-") && name.ends_with(".mp3"))
        {
            segments.push(path);
        }
    }
    segments.sort();
    Ok(segments)
}

/// Concatenate any recording segments in `dir` into a single `audio.mp3`, then
/// delete the segments. MP3 frame streams (no mid-stream ID3 tags — see
/// `Mp3Writer`) concatenate losslessly by raw byte append.
///
/// Idempotent: with no segments it leaves any existing `audio.mp3` untouched.
/// If `audio.mp3` already exists, newer segments are appended after it so a
/// second concat round (e.g. recording resumed after a prior concat) extends
/// the same file. Returns the final path when audio exists, else `None`.
fn concat_segments(dir: &Path) -> std::io::Result<Option<PathBuf>> {
    use std::io::Write;

    let final_path = dir.join("audio.mp3");
    let final_bytes = match std::fs::metadata(&final_path) {
        Ok(metadata) => metadata.len(),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => 0,
        Err(error) => return Err(error),
    };
    let mut timeline = Timeline::load(dir, final_bytes)?;
    let segments = list_segments(dir)?;
    // Deletion can fail after a successful concat. Their manifest entries make
    // retries idempotent even when committed segment files remain on disk.
    let pending: Vec<_> = segments
        .iter()
        .filter(|path| {
            !timeline.parts.iter().any(|part| {
                path.file_name()
                    .is_some_and(|name| name.to_string_lossy() == part.file_name)
            })
        })
        .collect();
    if pending.is_empty() {
        return Ok(final_path.exists().then_some(final_path));
    }

    let tmp = dir.join("audio.mp3.concat-tmp");
    {
        let mut out = std::io::BufWriter::new(std::fs::File::create(&tmp)?);
        if final_path.exists() {
            let bytes = std::fs::read(&final_path)?;
            out.write_all(&bytes)?;
            if timeline.parts.is_empty() && !bytes.is_empty() {
                timeline
                    .parts
                    .push(part_from_file(&final_path, final_bytes, &bytes)?);
            }
        }
        let mut byte_end = final_bytes;
        for seg in &pending {
            let bytes = std::fs::read(seg)?;
            out.write_all(&bytes)?;
            byte_end += u64::try_from(bytes.len()).map_err(std::io::Error::other)?;
            timeline.parts.push(part_from_file(seg, byte_end, &bytes)?);
        }
        out.flush()?;
    }
    // Stage provenance first. Timeline::load ignores entries past the final
    // file's byte length if the process stops before the audio rename.
    timeline.save(dir)?;
    std::fs::rename(&tmp, &final_path)?;
    for seg in &segments {
        if std::fs::remove_file(seg).is_ok() {
            let _ = std::fs::remove_file(seg.with_extension("timing.json"));
        }
    }

    log::info!(
        "[REC] concatenated {} segment(s) → {}",
        segments.len(),
        final_path.display()
    );
    Ok(Some(final_path))
}

/// Concatenate this session's recording segments into the final `audio.mp3`.
///
/// Call from the frontend AFTER transcription has fully stopped (poll
/// `get_stt_status` until false) so no segment is mid-write. Safe to call when
/// recording was disabled — it's a no-op if there are no segments. Updates
/// `audio_path` to the final file, or clears it if no audio was produced.
#[tauri::command]
pub fn finalize_session_audio(
    app: AppHandle,
    state: State<'_, Mutex<crate::state::AppState>>,
    db: State<'_, Mutex<SessionDb>>,
    session_id: i64,
) -> Result<Option<String>, String> {
    let state = state.lock().map_err(|error| error.to_string())?;
    state.ensure_session_audio_idle(session_id)?;
    let db = db.lock().map_err(|e| e.to_string())?;
    let session = db.get_session(session_id).map_err(|e| e.to_string())?;
    let dir = recording_dir(session_dir(&app, session_id), session.audio_path.as_deref());
    let final_path = concat_segments(&dir).map_err(|e| e.to_string())?;
    match &final_path {
        Some(path) => {
            db.set_session_audio_path(session_id, &path.to_string_lossy())
                .map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => {
            // No audio for this session — clear any eagerly-set path.
            db.clear_session_audio_path(session_id)
                .map_err(|e| e.to_string())?;
            Ok(None)
        }
    }
}

/// Read a session's recorded audio as raw bytes for in-app playback.
///
/// Returned as a binary `Response` (efficient IPC, not a JSON number array),
/// which `invoke` resolves to an `ArrayBuffer` the frontend wraps in a Blob.
/// We serve bytes over IPC instead of an `asset:` URL because Tauri's asset
/// protocol mishandles HTTP range requests for media on macOS WKWebView —
/// seeking a longer recording re-reads from byte 0 and crashes the WebView
/// renderer (tauri-apps/tauri#6375, #4826). A Blob URL seeks in-memory.
#[tauri::command]
pub fn read_session_audio(
    app: AppHandle,
    db: State<'_, Mutex<SessionDb>>,
    session_id: i64,
) -> Result<Response, String> {
    let path = {
        let db = db.lock().map_err(|e| e.to_string())?;
        let session = db.get_session(session_id).map_err(|e| e.to_string())?;
        session
            .audio_path
            .map(PathBuf::from)
            .unwrap_or_else(|| session_dir(&app, session_id).join("audio.mp3"))
    };
    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Failed to read audio {}: {e}", path.display()))?;
    Ok(Response::new(bytes))
}

/// Return wall-clock spans and playback offsets for this session's recording.
/// An empty timeline identifies a legacy recording; the player uses started_at.
#[tauri::command]
pub fn get_session_audio_timeline(
    app: AppHandle,
    db: State<'_, Mutex<SessionDb>>,
    session_id: i64,
) -> Result<Vec<timeline::AudioSpan>, String> {
    let path = {
        let db = db.lock().map_err(|error| error.to_string())?;
        db.get_session(session_id)
            .map_err(|error| error.to_string())?
            .audio_path
            .map(PathBuf::from)
            .unwrap_or_else(|| session_dir(&app, session_id).join("audio.mp3"))
    };
    let dir = path.parent().ok_or("Audio path has no parent directory")?;
    let final_bytes = std::fs::metadata(&path)
        .map_err(|error| error.to_string())?
        .len();
    Timeline::load(dir, final_bytes)
        .map(|timeline| timeline.spans())
        .map_err(|error| error.to_string())
}

/// Delete all recorded audio for a session (final file + any leftover
/// segments) and clear the `audio_path` column. Idempotent.
#[tauri::command]
pub fn delete_session_audio(
    app: AppHandle,
    state: State<'_, Mutex<crate::state::AppState>>,
    db: State<'_, Mutex<SessionDb>>,
    session_id: i64,
) -> Result<(), String> {
    let state = state.lock().map_err(|error| error.to_string())?;
    let db = db.lock().map_err(|error| error.to_string())?;
    let session = db.get_session(session_id).map_err(|e| e.to_string())?;
    let dir = recording_dir(session_dir(&app, session_id), session.audio_path.as_deref());
    delete_recording(&state, &db, session_id, &dir)
}

fn remove_recording_file(path: &Path) -> Result<(), String> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to delete {}: {error}", path.display())),
    }
}

fn delete_recording(
    state: &crate::state::AppState,
    db: &SessionDb,
    session_id: i64,
    dir: &Path,
) -> Result<(), String> {
    state.ensure_session_audio_idle(session_id)?;
    let session = db
        .get_session(session_id)
        .map_err(|error| error.to_string())?;
    let final_path = session
        .audio_path
        .map(PathBuf::from)
        .unwrap_or_else(|| dir.join("audio.mp3"));

    // Remove recoverable audio first. If any segment cannot be deleted, keep
    // the final recording, provenance and DB path so the failed delete is retryable.
    for segment in list_segments(dir).map_err(|error| error.to_string())? {
        remove_recording_file(&segment)?;
    }
    // Prepared sermon copies belong to this recording and must be deleted too.
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries {
            let path = entry.map_err(|error| error.to_string())?.path();
            if path.file_name().and_then(|name| name.to_str()).is_some_and(|name|
                name == "sermon-edit.json" || (name.starts_with("sermon-") && (name.ends_with(".mp3") || name.ends_with(".tmp")))) {
                remove_recording_file(&path)?;
            }
        }
    }
    remove_recording_file(&final_path)?;
    remove_recording_file(&dir.join("audio.mp3.concat-tmp"))?;
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => Some(entries),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(error.to_string()),
    };
    if let Some(entries) = entries {
        for entry in entries {
            let path = entry.map_err(|error| error.to_string())?.path();
            if path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| {
                    name.starts_with("audio-seg-") && name.ends_with(".timing.json")
                })
            {
                remove_recording_file(&path)?;
            }
        }
    }
    remove_recording_file(&dir.join(timeline::MANIFEST))?;
    db.clear_session_audio_path(session_id)
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rhema_notes::CreateSessionRequest;
    use tempfile::tempdir;

    #[test]
    fn delete_removes_file_and_clears_column() {
        let dir = tempdir().unwrap();
        let db = SessionDb::open(&dir.path().join("t.db")).unwrap();
        let session = db
            .create_session(&CreateSessionRequest {
                title_is_automatic: false,
                title: "T".into(),
                speaker: None,
                date: "2026-05-28".into(),
                series_name: None,
                tags: vec![],
                planned_scriptures: vec![],
            })
            .unwrap();
        let audio_path = dir.path().join("audio.mp3");
        std::fs::write(&audio_path, b"fake mp3").unwrap();
        db.set_session_audio_path(session.id, audio_path.to_str().unwrap())
            .unwrap();

        let derived = dir.path().join("sermon-abcdef.mp3");
        std::fs::write(&derived, b"prepared copy").unwrap();
        std::fs::write(dir.path().join("sermon-edit.json"), b"{}").unwrap();
        delete_recording(&crate::state::AppState::new(), &db, session.id, dir.path()).unwrap();
        let reloaded = db.get_session(session.id).unwrap();
        assert_eq!(reloaded.audio_path, None);
        assert!(!audio_path.exists());
        assert!(!derived.exists());
        assert!(!dir.path().join("sermon-edit.json").exists());
    }

    #[test]
    fn concat_merges_segments_in_order_and_removes_them() {
        let dir = tempdir().unwrap();
        let p = dir.path();
        // Three out-of-creation-order writes; names sort chronologically.
        std::fs::write(p.join("audio-seg-0000000000002.mp3"), b"BBB").unwrap();
        std::fs::write(p.join("audio-seg-0000000000001.mp3"), b"AAA").unwrap();
        std::fs::write(p.join("audio-seg-0000000000003.mp3"), b"CCC").unwrap();

        let out = concat_segments(p).unwrap().unwrap();
        assert_eq!(out, p.join("audio.mp3"));
        assert_eq!(std::fs::read(&out).unwrap(), b"AAABBBCCC");

        // Segments removed after merge.
        assert!(list_segments(p).unwrap().is_empty());
    }

    #[test]
    fn concat_no_segments_is_noop() {
        let dir = tempdir().unwrap();
        assert_eq!(concat_segments(dir.path()).unwrap(), None);
    }

    #[test]
    fn concat_appends_to_existing_final() {
        let dir = tempdir().unwrap();
        let p = dir.path();
        std::fs::write(p.join("audio.mp3"), b"OLD").unwrap();
        std::fs::write(p.join("audio-seg-0000000000005.mp3"), b"NEW").unwrap();

        let out = concat_segments(p).unwrap().unwrap();
        assert_eq!(std::fs::read(&out).unwrap(), b"OLDNEW");
    }
    fn timed_segment(dir: &Path, name: &str, start_ms: u64, sample_count: usize) -> PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, b"timed mp3 data").unwrap();
        let mut timing = timeline::SegmentTiming::new(16_000);
        timing.record_frame(
            start_ms + u64::try_from(sample_count).unwrap() * 1000 / 16_000,
            sample_count,
        );
        timing.save(&path).unwrap();
        path
    }

    #[test]
    fn concat_preserves_sample_timing_across_pauses_and_later_restarts() {
        let dir = tempdir().unwrap();
        let p = dir.path();
        let first = timed_segment(p, "audio-seg-0000000010000.mp3", 10_000, 160_000);
        let paused = timed_segment(p, "audio-seg-0000000040000.mp3", 40_000, 80_000);
        concat_segments(p).unwrap();
        assert!(!first.with_extension("timing.json").exists());
        assert!(!paused.with_extension("timing.json").exists());
        let final_path = p.join("audio.mp3");
        let timeline = Timeline::load(p, std::fs::metadata(&final_path).unwrap().len()).unwrap();
        let spans = timeline.spans();
        assert_eq!(spans.len(), 2);
        assert_eq!(spans[0].wall_start_ms, Some(10_000));
        assert_eq!(spans[0].duration_ms, 10_000.0);
        assert_eq!(spans[1].wall_start_ms, Some(40_000));
        assert_eq!(spans[1].audio_start_ms, 10_000.0);
        assert_eq!(spans[1].duration_ms, 5_000.0);

        timed_segment(p, "audio-seg-0000000090000.mp3", 90_000, 64_000);
        concat_segments(p).unwrap();
        let final_bytes = std::fs::metadata(&final_path).unwrap().len();
        let timeline = Timeline::load(p, final_bytes).unwrap();
        let spans = timeline.spans();
        assert_eq!(spans[2].wall_start_ms, Some(90_000));
        assert_eq!(spans[2].audio_start_ms, 15_000.0);
        assert_eq!(spans[2].duration_ms, 4_000.0);
        concat_segments(p).unwrap();
        assert_eq!(std::fs::metadata(final_path).unwrap().len(), final_bytes);
    }

    #[test]
    fn concat_retry_does_not_duplicate_a_committed_segment_left_on_disk() {
        let dir = tempdir().unwrap();
        let p = dir.path();
        let segment = timed_segment(p, "audio-seg-0000000010000.mp3", 10_000, 16_000);
        let bytes = std::fs::read(&segment).unwrap();
        concat_segments(p).unwrap();
        // Simulate removal failure after audio rename (e.g. a locked segment).
        std::fs::write(&segment, &bytes).unwrap();
        concat_segments(p).unwrap();
        assert_eq!(std::fs::read(p.join("audio.mp3")).unwrap(), bytes);
    }

    #[test]
    fn staged_manifest_is_rebuilt_when_concat_stopped_before_audio_rename() {
        let dir = tempdir().unwrap();
        let p = dir.path();
        let segment = timed_segment(p, "audio-seg-0000000010000.mp3", 10_000, 16_000);
        let bytes = std::fs::read(&segment).unwrap();
        Timeline {
            parts: vec![
                part_from_file(&segment, u64::try_from(bytes.len()).unwrap(), &bytes).unwrap(),
            ],
        }
        .save(p)
        .unwrap();
        concat_segments(p).unwrap();
        let timeline = Timeline::load(p, u64::try_from(bytes.len()).unwrap()).unwrap();
        assert_eq!(timeline.parts.len(), 1);
        assert_eq!(std::fs::read(p.join("audio.mp3")).unwrap(), bytes);
    }

    #[test]
    fn legacy_recordings_have_no_wall_clock_mapping() {
        let dir = tempdir().unwrap();
        let p = dir.path();
        std::fs::write(p.join("audio.mp3"), b"old recording").unwrap();
        assert!(Timeline::load(p, 13).unwrap().spans().is_empty());
        timed_segment(p, "audio-seg-0000000090000.mp3", 90_000, 16_000);
        concat_segments(p).unwrap();
        let bytes = std::fs::metadata(p.join("audio.mp3")).unwrap().len();
        let spans = Timeline::load(p, bytes).unwrap().spans();
        assert_eq!(spans[0].wall_start_ms, None);
        assert_eq!(spans[1].wall_start_ms, Some(90_000));
    }
    #[test]
    fn failed_segment_deletion_preserves_provenance_and_db_until_retry_succeeds() {
        let dir = tempdir().unwrap();
        let p = dir.path();
        let db = SessionDb::open(&p.join("t.db")).unwrap();
        let session = db
            .create_session(&CreateSessionRequest {
                title_is_automatic: false,
                title: "Delete retry".into(),
                speaker: None,
                date: "2026-10-17".into(),
                series_name: None,
                tags: vec![],
                planned_scriptures: vec![],
            })
            .unwrap();
        let final_path = p.join("audio.mp3");
        std::fs::write(&final_path, b"final audio").unwrap();
        db.set_session_audio_path(session.id, final_path.to_str().unwrap())
            .unwrap();
        let blocked = p.join("audio-seg-0000000000001.mp3");
        // A directory cannot be removed as a file on any supported platform.
        std::fs::create_dir(&blocked).unwrap();
        let sidecar = blocked.with_extension("timing.json");
        let manifest = p.join(timeline::MANIFEST);
        std::fs::write(&sidecar, b"timing").unwrap();
        std::fs::write(&manifest, b"manifest").unwrap();

        assert!(delete_recording(&crate::state::AppState::new(), &db, session.id, p).is_err());
        assert_eq!(
            db.get_session(session.id).unwrap().audio_path.as_deref(),
            final_path.to_str()
        );
        assert!(final_path.exists());
        assert!(sidecar.exists());
        assert!(manifest.exists());

        std::fs::remove_dir(&blocked).unwrap();
        std::fs::write(&blocked, b"segment audio").unwrap();
        delete_recording(&crate::state::AppState::new(), &db, session.id, p).unwrap();
        assert_eq!(db.get_session(session.id).unwrap().audio_path, None);
        assert!(!sidecar.exists());
        assert!(!manifest.exists());
        assert_eq!(concat_segments(p).unwrap(), None);
    }
    #[test]
    fn active_recording_deletion_leaves_audio_and_db_path_untouched() {
        let dir = tempdir().unwrap();
        let db = SessionDb::open(&dir.path().join("session.db")).unwrap();
        let session = db
            .create_session(&CreateSessionRequest {
                title: "Recording".into(),
                title_is_automatic: false,
                date: "2026-10-18".into(),
                speaker: None,
                series_name: None,
                tags: vec![],
                planned_scriptures: vec![],
            })
            .unwrap();
        let audio = dir.path().join("audio-seg-0000000000001.mp3");
        std::fs::write(&audio, b"captured audio").unwrap();
        db.set_session_audio_path(session.id, audio.to_str().unwrap())
            .unwrap();
        let mut state = crate::state::AppState::new();
        state.transcription_session_id = Some(session.id);
        state
            .stt_active
            .store(true, std::sync::atomic::Ordering::SeqCst);
        assert!(delete_recording(&state, &db, session.id, dir.path()).is_err());
        assert_eq!(std::fs::read(&audio).unwrap(), b"captured audio");
        assert_eq!(
            db.get_session(session.id).unwrap().audio_path.as_deref(),
            audio.to_str()
        );
    }
}
