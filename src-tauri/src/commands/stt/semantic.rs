use crate::state::AppState;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

/// Minimum word count for semantic detection. Short phrases like "God is good"
/// or "praise the Lord" create too many false positives. Direct detection
/// still catches short explicit references like "Psalm 1:1".
const SEMANTIC_MIN_WORDS: usize = 5;

/// Cooldown between semantic detections (milliseconds). Prevents rapid-fire
/// flooding when the pastor is speaking continuously.
const SEMANTIC_COOLDOWN_MS: u64 = 3000;

/// Track last semantic detection time for cooldown
static LAST_SEMANTIC_EMIT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

/// Run semantic (ONNX embedding) detection. Slow, runs in background worker.
pub(super) fn run_semantic_detection(
    app: &AppHandle,
    transcript: &str,
    active: &std::sync::atomic::AtomicBool,
) {
    // Char-safe truncation — raw byte slice panics on multi-byte UTF-8.
    let preview: String = transcript.chars().take(80).collect();
    log::info!("[DET-SEMANTIC] Running on: {preview:?}");

    // Skip short phrases — too many false positives from casual speech
    let word_count = transcript.split_whitespace().count();
    if word_count < SEMANTIC_MIN_WORDS {
        log::info!("[DET-SEMANTIC] Skipped: only {word_count} words (min {SEMANTIC_MIN_WORDS})");
        return;
    }

    // Cooldown — don't emit another semantic detection within 3 seconds
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let last = LAST_SEMANTIC_EMIT.load(std::sync::atomic::Ordering::Relaxed);
    if now_ms.saturating_sub(last) < SEMANTIC_COOLDOWN_MS {
        log::info!("[DET-SEMANTIC] Cooldown active, skipping");
        return;
    }
    let managed: State<'_, Mutex<AppState>> = app.state();
    let pipeline = match crate::state::detection_pipeline(&managed) {
        Ok(pipeline) => pipeline,
        Err(e) => {
            log::error!("Semantic pipeline unavailable: {e}");
            return;
        }
    };
    let wait_started = std::time::Instant::now();
    let mut detections = match pipeline.lock() {
        Ok(mut pipeline) => {
            let wait_ms = wait_started.elapsed().as_millis();
            let search_started = std::time::Instant::now();
            let results = pipeline.process_semantic(transcript);
            log::info!(
                "[DET-SEMANTIC] timing: wait_ms={wait_ms}, search_ms={}, results={}",
                search_started.elapsed().as_millis(),
                results.len()
            );
            results
        }
        Err(e) => {
            log::error!("Semantic pipeline lock failed: {e}");
            return;
        }
    };
    let mut app_state = match managed.lock() {
        Ok(state) => state,
        Err(e) => {
            log::error!("AppState lock failed: {e}");
            return;
        }
    };
    if !active.load(std::sync::atomic::Ordering::SeqCst) {
        return;
    }
    // Semantic hits carry database IDs; context scoring needs real coordinates.
    for merged in &mut detections {
        crate::commands::detection::resolve_semantic_reference(&app_state, merged);
    }
    if detections.is_empty() {
        log::info!("[DET-SEMANTIC] No detections");
        return;
    }

    // Apply context boosting: same-book/chapter detections get higher confidence
    for m in &mut detections {
        let boost = app_state.sermon_context.confidence_boost(
            m.detection.verse_ref.book_number,
            m.detection.verse_ref.chapter,
        );
        if boost > 0.0 {
            m.detection.confidence = (m.detection.confidence + boost).min(1.0);
        }
    }

    detections.sort_by(|a, b| b.detection.confidence.total_cmp(&a.detection.confidence));

    // Update sermon context with the top detection
    if let Some(top) = detections.first() {
        app_state.sermon_context.update(
            &top.detection.verse_ref,
            top.detection.confidence,
            "semantic",
        );
    }

    // Only emit top 3 results above 60% confidence
    // Higher threshold reduces false positives from casual speech
    let results: Vec<crate::commands::detection::DetectionResult> = detections
        .iter()
        .take(3)
        .filter(|m| m.detection.confidence >= 0.60)
        .map(|m| crate::commands::detection::to_result(&app_state, m))
        .collect();
    for r in &results {
        log::info!(
            "[DET-SEMANTIC] Emitting: {} ({:.0}% {})",
            r.verse_ref,
            r.confidence * 100.0,
            r.source
        );
    }
    if results.is_empty() {
        log::info!("[DET-SEMANTIC] Top result below 60% threshold, suppressed");
    }
    drop(app_state);
    if !results.is_empty() {
        // Update cooldown timestamp
        LAST_SEMANTIC_EMIT.store(now_ms, std::sync::atomic::Ordering::Relaxed);
        let _ = app.emit("verse_detections", &results);
    }
}
