use crate::state::AppState;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

/// Check for voice translation commands like "read in NIV", "switch to ESV".
pub(super) fn check_translation_command(app: &AppHandle, transcript: &str) {
    #[derive(serde::Serialize, Clone)]
    struct TranslationSwitch {
        abbreviation: String,
        translation_id: i64,
    }

    let detector_state: State<'_, Mutex<rhema_detection::DirectDetector>> = app.state();
    let Ok(detector) = detector_state.lock() else {
        return;
    };

    if let Some(abbrev) = detector.detect_translation_command(transcript) {
        drop(detector);

        // Find the translation ID for this abbreviation
        let managed: State<'_, Mutex<AppState>> = app.state();
        let Ok(mut app_state) = managed.try_lock() else {
            return;
        };

        if let Some(ref db) = app_state.bible_db {
            if let Ok(translations) = db.list_translations() {
                if let Some(t) = translations.iter().find(|t| t.abbreviation == abbrev) {
                    app_state.active_translation_id = t.id;
                    log::info!("[STT] Voice command: switched to {abbrev} (id={})", t.id);
                    drop(app_state);

                    let _ = app.emit(
                        "translation_command",
                        TranslationSwitch {
                            abbreviation: abbrev,
                            translation_id: t.id,
                        },
                    );
                }
            }
        }
    }
}
