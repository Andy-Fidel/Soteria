use crate::state::AppState;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

/// Run quotation matching against all loaded Bible translations.
pub(super) fn run_quotation_matching(app: &AppHandle, transcript: &str) {
    // When reading mode is active, suppress quotation matching entirely.
    // The reader is actively reading a passage — quotation matches for
    // OTHER books would hijack the display away from what's being read.
    {
        use rhema_detection::ReadingMode;
        let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();
        if let Ok(rm) = rm_managed.lock() {
            if rm.is_active() || rm.has_verses() {
                return; // Reading mode owns the display
            }
        }
    }

    let managed: State<'_, Mutex<AppState>> = app.state();
    let Ok(app_state) = managed.try_lock() else {
        return;
    }; // AppState busy

    if !app_state.quotation_matcher.is_ready() {
        return;
    }

    let detections = app_state.quotation_matcher.match_transcript(transcript);
    if detections.is_empty() {
        return;
    }

    let results: Vec<crate::commands::detection::DetectionResult> = detections
        .iter()
        .map(|d| {
            let vr = &d.verse_ref;
            // Try to resolve verse text from DB
            let verse_text = if let Some(ref db) = app_state.bible_db {
                db.get_verse(
                    app_state.active_translation_id,
                    vr.book_number,
                    vr.chapter,
                    vr.verse_start,
                )
                .ok()
                .flatten()
                .map(|v| v.text)
                .unwrap_or_default()
            } else {
                String::new()
            };

            crate::commands::detection::DetectionResult {
                verse_ref: format!("{} {}:{}", vr.book_name, vr.chapter, vr.verse_start),
                verse_text,
                book_name: vr.book_name.clone(),
                book_number: vr.book_number,
                chapter: vr.chapter,
                verse: vr.verse_start,
                confidence: d.confidence,
                source: "quotation".to_string(),
                auto_queued: d.confidence >= 0.85,
                transcript_snippet: d.transcript_snippet.clone(),
            }
        })
        .collect();

    for r in &results {
        log::info!(
            "[DET-QUOTATION] Found: {} ({:.0}%) auto_q={}",
            r.verse_ref,
            r.confidence * 100.0,
            r.auto_queued
        );
    }

    drop(app_state);
    let _ = app.emit("verse_detections", &results);
}
