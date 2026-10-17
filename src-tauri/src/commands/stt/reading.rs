use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

/// Check reading mode: if active, test transcript against expected verse.
/// If direct detection just found a new verse, start/restart reading mode.
/// Returns `true` when reading mode handled the transcript (suppresses semantic).
#[expect(
    clippy::too_many_lines,
    reason = "sequential state-machine logic is clearer in one flow"
)]
pub(super) fn check_reading_mode(app: &AppHandle, transcript: &str, direct_found: bool) -> bool {
    use rhema_detection::ReadingMode;

    // If direct detection found a verse, consider starting/restarting reading mode.
    // BUT: if reading mode is already active on a book/chapter, do NOT restart
    // on a different book — false positives from bare numbers (e.g., "verse 5"
    // getting matched as "Job 3:5") would hijack the reading session.
    if direct_found {
        let verse_info = {
            let detector_state: State<'_, Mutex<rhema_detection::DirectDetector>> = app.state();
            let Ok(detector) = detector_state.lock() else {
                return false;
            };
            detector.recent_detections().front().cloned()
        };

        if let Some(recent) = verse_info {
            // Get the confidence of the detection to distinguish explicit refs from false positives
            let detection_confidence = {
                let detector_state: State<'_, Mutex<rhema_detection::DirectDetector>> = app.state();
                detector_state
                    .lock()
                    .ok()
                    .and_then(|d| d.recent_detections().front().map(|_| 0.95)) // Direct detections are always high confidence
                    .unwrap_or(0.0)
            };

            let should_start = {
                let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();
                match rm_managed.lock() {
                    Ok(rm) => {
                        if !rm.is_active() && !rm.has_verses() {
                            true // Not active, no verses loaded — start fresh
                        } else if !rm.is_active() && rm.has_verses() {
                            // Paused — restart on any new explicit reference
                            true
                        } else if rm.current_book() == recent.book_number
                            && rm.current_chapter() == recent.chapter
                        {
                            false // Same book+chapter — already tracking this
                        } else if rm.current_book() != recent.book_number
                            && detection_confidence >= 0.90
                        {
                            // Different book with high confidence — explicit new reference
                            // (e.g., "John 1:1" after reading Exodus). Restart.
                            true
                        } else if rm.current_book() == recent.book_number {
                            // Same book, different chapter — natural progression
                            true
                        } else {
                            // Different book, low confidence — likely false positive
                            false
                        }
                    }
                    Err(_) => false,
                }
            };

            if should_start {
                let chapter_data = {
                    let app_managed: State<'_, Mutex<crate::state::AppState>> = app.state();
                    let Ok(app_state) = app_managed.try_lock() else {
                        return false;
                    };
                    match &app_state.bible_db {
                        Some(db) => db
                            .get_chapter(
                                app_state.active_translation_id,
                                recent.book_number,
                                recent.chapter,
                            )
                            .ok(),
                        None => None,
                    }
                };

                if let Some(chapter_verses) = chapter_data {
                    let verses: Vec<(i32, String)> = chapter_verses
                        .into_iter()
                        .map(|v| (v.verse, v.text))
                        .collect();

                    let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();
                    if let Ok(mut rm) = rm_managed.lock() {
                        rm.start(
                            recent.book_number,
                            &recent.book_name,
                            recent.chapter,
                            recent.verse_start,
                            verses,
                        );
                    }
                }
            }
        }
    }

    let rm_managed: &Mutex<ReadingMode> = app.state::<Mutex<ReadingMode>>().inner();

    // Check for chapter navigation commands (e.g., "let's go to chapter seven").
    {
        let chapter_change = {
            let Ok(rm) = rm_managed.lock() else {
                return false;
            };
            if !rm.is_active() && !rm.has_verses() {
                None
            } else {
                rm.check_chapter_command(transcript)
            }
        };

        if let Some(change) = chapter_change {
            let chapter_data = {
                let app_managed: State<'_, Mutex<crate::state::AppState>> = app.state();
                let Ok(app_state) = app_managed.try_lock() else {
                    return false;
                };
                match &app_state.bible_db {
                    Some(db) => db
                        .get_chapter(
                            app_state.active_translation_id,
                            change.book_number,
                            change.new_chapter,
                        )
                        .ok(),
                    None => None,
                }
            };

            if let Some(chapter_verses) = chapter_data {
                if !chapter_verses.is_empty() {
                    let first_text = chapter_verses[0].text.clone();
                    let verses: Vec<(i32, String)> = chapter_verses
                        .into_iter()
                        .map(|v| (v.verse, v.text))
                        .collect();

                    if let Ok(mut rm) = rm_managed.lock() {
                        rm.start(
                            change.book_number,
                            &change.book_name,
                            change.new_chapter,
                            1,
                            verses,
                        );
                    }

                    // Emit verse 1 of the new chapter
                    let reference = format!("{} {}:1", change.book_name, change.new_chapter);
                    let advance = rhema_detection::ReadingAdvance {
                        book_number: change.book_number,
                        book_name: change.book_name.clone(),
                        chapter: change.new_chapter,
                        verse: 1,
                        verse_text: first_text.clone(),
                        reference: reference.clone(),
                        confidence: 1.0,
                    };
                    let _ = app.emit("reading_mode_verse", &advance);

                    let result = crate::commands::detection::DetectionResult {
                        verse_ref: reference,
                        verse_text: first_text,
                        book_name: change.book_name,
                        book_number: change.book_number,
                        chapter: change.new_chapter,
                        verse: 1,
                        confidence: 1.0,
                        source: "contextual".to_string(),
                        auto_queued: true,
                        transcript_snippet: String::new(),
                    };
                    let _ = app.emit("verse_detections", &vec![result]);

                    return true;
                }
            }
        }
    }

    // Check reading mode for verse advancement.
    // Allow check even when paused (has_verses but !active) so "verse N"
    // commands can re-activate reading mode after timeout.
    let advance = {
        let Ok(mut rm) = rm_managed.lock() else {
            return false;
        };
        if !rm.is_active() && !rm.has_verses() {
            return false;
        }
        rm.check_transcript(transcript)
    };

    if let Some(advance) = advance {
        let _ = app.emit("reading_mode_verse", &advance);

        let result = crate::commands::detection::DetectionResult {
            verse_ref: advance.reference.clone(),
            verse_text: advance.verse_text.clone(),
            book_name: advance.book_name.clone(),
            book_number: advance.book_number,
            chapter: advance.chapter,
            verse: advance.verse,
            confidence: advance.confidence,
            source: "contextual".to_string(),
            auto_queued: true,
            transcript_snippet: String::new(),
        };
        let _ = app.emit("verse_detections", &vec![result]);
        return true;
    }

    false
}
