use crate::state::AppState;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

/// Run direct (regex/pattern) detection only. Instant, no ONNX.
/// Uses SEPARATE Mutex<DirectDetector> and Mutex<DetectionMerger> so it
/// never blocks on the semantic worker, and cooldown state persists across calls.
/// Returns true if high-confidence results were found (>= 0.90).
#[expect(
    clippy::similar_names,
    reason = "merger and merged are naturally named"
)]
pub(super) fn run_direct_detection(app: &AppHandle, transcript: &str) -> bool {
    use rhema_detection::{DetectionMerger, DirectDetector};

    let detector_state: State<'_, Mutex<DirectDetector>> = app.state();
    let mut detector = match detector_state.lock() {
        Ok(d) => d,
        Err(e) => {
            log::error!("Failed to lock DirectDetector: {e}");
            return false;
        }
    };
    let direct_results = detector.detect(transcript);
    drop(detector); // Release immediately

    if direct_results.is_empty() {
        return false;
    }

    // Check if any result has high confidence before merging
    let has_high_confidence = direct_results.iter().any(|d| d.confidence >= 0.90);

    // Merge using the managed merger (persists cooldown state across calls,
    // preventing duplicate emissions when running on both partials and finals)
    let merger_state: State<'_, Mutex<DetectionMerger>> = app.state();
    let mut merger = match merger_state.lock() {
        Ok(m) => m,
        Err(e) => {
            log::error!("Failed to lock DetectionMerger: {e}");
            return false;
        }
    };
    let merged = merger.merge(direct_results, vec![]);
    drop(merger);
    if merged.is_empty() {
        return false;
    }

    // Resolve verse info from DB (needs AppState, but only briefly for DB lookup)
    let app_managed: State<'_, Mutex<AppState>> = app.state();
    let Ok(mut app_state) = app_managed.try_lock() else {
        // AppState locked by semantic worker — emit results without verse text
        let results: Vec<crate::commands::detection::DetectionResult> = merged
            .iter()
            .map(|m| {
                let vr = &m.detection.verse_ref;
                crate::commands::detection::DetectionResult {
                    verse_ref: format!("{} {}:{}", vr.book_name, vr.chapter, vr.verse_start),
                    verse_text: String::new(),
                    book_name: vr.book_name.clone(),
                    book_number: vr.book_number,
                    chapter: vr.chapter,
                    verse: vr.verse_start,
                    confidence: m.detection.confidence,
                    source: "direct".to_string(),
                    auto_queued: m.auto_queued,
                    transcript_snippet: m.detection.transcript_snippet.clone(),
                }
            })
            .collect();
        for r in &results {
            log::info!(
                "[DET-DIRECT] Found: {} ({:.0}%) (no DB)",
                r.verse_ref,
                r.confidence * 100.0
            );
        }
        let _ = app.emit("verse_detections", &results);
        return has_high_confidence;
    };
    let results: Vec<crate::commands::detection::DetectionResult> = merged
        .iter()
        .map(|m| crate::commands::detection::to_result(&app_state, m))
        // Filter out detections where the verse doesn't exist in the DB
        // (e.g., "Isaiah 4:13" — Isaiah 4 only has 6 verses)
        .filter(|r| !r.verse_text.is_empty())
        .collect();

    // Update sermon context only for validated detections
    for m in &merged {
        let vr = &m.detection.verse_ref;
        let ref_str = format!("{} {}:{}", vr.book_name, vr.chapter, vr.verse_start);
        if results.iter().any(|r| r.verse_ref == ref_str) {
            app_state
                .sermon_context
                .update(vr, m.detection.confidence, "direct");
        }
    }

    for r in &results {
        log::info!(
            "[DET-DIRECT] Found: {} ({:.0}%)",
            r.verse_ref,
            r.confidence * 100.0
        );
    }
    drop(app_state);
    if !results.is_empty() {
        let _ = app.emit("verse_detections", &results);
    }
    has_high_confidence
}
