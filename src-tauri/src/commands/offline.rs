//! Readiness reflects initialized local engines, not just files on disk.
use crate::state::{detection_pipeline, AppState};
use rhema_notes::SessionDb;
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalResourceStatus {
    pub translations: Vec<String>,
    pub quotation_ready: bool,
    pub semantic_ready: bool,
    pub session_storage_ready: bool,
}

/// Inspect local resources without audio capture, network requests, or session writes.
#[tauri::command]
pub async fn get_local_resource_status(app: AppHandle) -> Result<LocalResourceStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<Mutex<AppState>>();
        inspect_local_resources(&state, app.try_state::<Mutex<SessionDb>>().is_some())
    })
    .await
    .map_err(|error| error.to_string())?
}

fn inspect_local_resources(
    state: &Mutex<AppState>,
    session_storage_ready: bool,
) -> Result<LocalResourceStatus, String> {
    let (translations, quotation_ready) = {
        let state = state.lock().map_err(|error| error.to_string())?;
        let translations = match &state.bible_db {
            Some(db) => db
                .list_translations()
                .map_err(|error| error.to_string())?
                .into_iter()
                .filter(|translation| {
                    // A metadata row alone does not prove that the Bible text is installed.
                    db.get_verse(translation.id, 43, 3, 16)
                        .ok()
                        .flatten()
                        .is_some_and(|verse| !verse.text.trim().is_empty())
                })
                .map(|translation| translation.abbreviation)
                .collect(),
            None => Vec::new(),
        };
        (translations, state.quotation_matcher.is_ready())
    };
    // Never hold the application lock while waiting for an inference lock.
    let pipeline = detection_pipeline(state)?;
    let semantic_ready = pipeline
        .lock()
        .map_err(|error| error.to_string())?
        .has_semantic();
    Ok(LocalResourceStatus {
        translations,
        quotation_ready,
        semantic_ready,
        session_storage_ready,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_resources_do_not_report_readiness() {
        let status = inspect_local_resources(&Mutex::new(AppState::new()), false).unwrap();
        assert!(status.translations.is_empty());
        assert!(!status.quotation_ready);
        assert!(!status.semantic_ready);
        assert!(!status.session_storage_ready);
    }

    #[test]
    fn translation_metadata_without_readable_text_is_not_ready() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("bible.db");
        let database = rusqlite::Connection::open(&path).unwrap();
        database.execute_batch("CREATE TABLE translations (id INTEGER, abbreviation TEXT, title TEXT, language TEXT, is_copyrighted INTEGER, is_downloaded INTEGER);
            INSERT INTO translations VALUES (1,'KJV','King James Version','en',0,1);
            CREATE TABLE verses (id INTEGER, translation_id INTEGER, book_number INTEGER, book_name TEXT, book_abbreviation TEXT, chapter INTEGER, verse INTEGER, text TEXT);").unwrap();
        let mut state = AppState::new();
        state.bible_db = Some(rhema_bible::BibleDb::open(&path).unwrap());
        assert!(inspect_local_resources(&Mutex::new(state), true)
            .unwrap()
            .translations
            .is_empty());
    }

    #[test]
    fn installed_text_is_reported_without_semantic_or_cloud_engines() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("bible.db");
        let database = rusqlite::Connection::open(&path).unwrap();
        database.execute_batch("CREATE TABLE translations (id INTEGER, abbreviation TEXT, title TEXT, language TEXT, is_copyrighted INTEGER, is_downloaded INTEGER);
            INSERT INTO translations VALUES (1,'KJV','King James Version','en',0,1);
            CREATE TABLE verses (id INTEGER, translation_id INTEGER, book_number INTEGER, book_name TEXT, book_abbreviation TEXT, chapter INTEGER, verse INTEGER, text TEXT);
            INSERT INTO verses VALUES (1,1,43,'John','Jn',3,16,'For God so loved the world');").unwrap();
        let mut state = AppState::new();
        state.bible_db = Some(rhema_bible::BibleDb::open(&path).unwrap());
        let status = inspect_local_resources(&Mutex::new(state), true).unwrap();
        assert_eq!(status.translations, vec!["KJV"]);
        assert!(status.session_storage_ready);
        assert!(!status.semantic_ready);
    }

    fn packaged_resources() -> std::path::PathBuf {
        std::env::var_os("SOTERIA_OFFLINE_RESOURCE_DIR")
            .map(std::path::PathBuf::from)
            .expect("Set SOTERIA_OFFLINE_RESOURCE_DIR to a verified package's Resources folder")
    }

    #[test]
    #[ignore = "requires a locally provisioned resource pack; never downloads resources"]
    fn packaged_bible_and_quotation_engines_work_without_network() {
        let database =
            rhema_bible::BibleDb::open(&packaged_resources().join("data/rhema.db")).unwrap();
        let translation = database
            .list_translations()
            .unwrap()
            .into_iter()
            .find(|item| item.abbreviation == "KJV")
            .unwrap();
        let verse = database
            .get_verse(translation.id, 43, 3, 16)
            .unwrap()
            .unwrap();
        let matcher = rhema_detection::QuotationMatcher::build(
            database.load_all_verses_for_quotation(Some("en")).unwrap(),
        );
        assert!(matcher
            .match_transcript(&verse.text)
            .iter()
            .any(|hit| hit.verse_ref.book_number == 43
                && hit.verse_ref.chapter == 3
                && hit.verse_ref.verse_start == 16));
        let mut state = AppState::new();
        state.bible_db = Some(database);
        state.quotation_matcher = matcher;
        let _sessions = SessionDb::open(std::path::Path::new(":memory:")).unwrap();
        let state = Mutex::new(state);
        let status = inspect_local_resources(&state, true).unwrap();
        for translation in ["KJV", "NIV", "NLT"] {
            assert!(status.translations.iter().any(|name| name == translation));
        }
        assert!(status.quotation_ready);
        assert!(status.session_storage_ready);
        let pipeline = detection_pipeline(&state).unwrap();
        assert!(pipeline
            .lock()
            .unwrap()
            .process("John 3:16")
            .iter()
            .any(|hit| hit.detection.verse_ref.book_number == 43
                && hit.detection.verse_ref.chapter == 3
                && hit.detection.verse_ref.verse_start == 16));
    }

    #[cfg(feature = "whisper")]
    #[test]
    #[ignore = "loads the real local speech model; no microphone or speech API is used"]
    fn packaged_speech_model_loads_without_network() {
        let name = if cfg!(target_os = "windows") {
            "ggml-base.en.bin"
        } else {
            "ggml-small.en-q8_0.bin"
        };
        let model = packaged_resources().join("models/whisper").join(name);
        assert!(crate::commands::stt::local::whisper_context_check(&model).is_ok());
    }
}
