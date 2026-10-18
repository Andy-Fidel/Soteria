use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use rhema_bible::BibleDb;
use rhema_detection::{DetectionPipeline, QuotationMatcher, SermonContext};
use rhema_stt::SttProvider;

pub struct AppState {
    pub bible_db: Option<BibleDb>,
    pub transcription_session_id: Option<i64>,
    pub capture_thread: Option<std::thread::JoinHandle<()>>,
    pub provider_task: Option<tauri::async_runtime::JoinHandle<()>>,
    pub transcript_task: Option<tauri::async_runtime::JoinHandle<()>>,
    pub stt_stopping: bool,
    pub detection_pipeline: Arc<Mutex<DetectionPipeline>>,
    pub sermon_context: SermonContext,
    pub quotation_matcher: QuotationMatcher,
    pub active_translation_id: i64,
    pub audio_active: Arc<AtomicBool>,
    pub stt_active: Arc<AtomicBool>,
    /// When true, the audio-fanout thread finalizes its current MP3 segment and
    /// stops writing audio while transcription keeps running. Flipping back to
    /// false opens a fresh segment. Segments merge into one file on End Session.
    pub recording_paused: Arc<AtomicBool>,
    /// Standalone test-capture loop (no STT). Toggled by `start_audio_test` /
    /// `stop_audio_test`. Separate from `audio_active` so the user can probe
    /// the mic while a transcription session is also running.
    pub audio_test_active: Arc<AtomicBool>,
    /// Handle to the currently running STT provider. `stop_transcription` calls
    /// `.stop()` on this to cancel the WS client deterministically, rather than
    /// relying on the audio channel drop to propagate cancellation.
    pub stt_provider: Option<Arc<dyn SttProvider>>,
    #[expect(dead_code, reason = "reserved for future Deepgram key injection")]
    pub deepgram_api_key: Option<String>,
    /// Holds the OS-level sleep-inhibitor while Manna is running. Dropped on
    /// app shutdown releases the assertion. Kept as `Option` so creation
    /// failures don't bring the app down.
    pub keepawake: Option<keepawake::KeepAwake>,
}

impl AppState {
    pub fn ensure_session_audio_idle(&self, session_id: i64) -> Result<(), String> {
        if self.transcription_session_id == Some(session_id)
            && (self.stt_active.load(std::sync::atomic::Ordering::SeqCst)
                || self.stt_stopping
                || self
                    .capture_thread
                    .as_ref()
                    .is_some_and(|thread| !thread.is_finished()))
        {
            return Err("Stop this session's recording before changing its audio files.".into());
        }
        Ok(())
    }

    pub fn new() -> Self {
        Self {
            bible_db: None,
            transcription_session_id: None,
            capture_thread: None,
            provider_task: None,
            transcript_task: None,
            stt_stopping: false,
            detection_pipeline: Arc::new(Mutex::new(DetectionPipeline::new())),
            sermon_context: SermonContext::new(),
            quotation_matcher: QuotationMatcher::new(),
            active_translation_id: 1, // Default to first translation (KJV)
            audio_active: Arc::new(AtomicBool::new(false)),
            stt_active: Arc::new(AtomicBool::new(false)),
            recording_paused: Arc::new(AtomicBool::new(false)),
            audio_test_active: Arc::new(AtomicBool::new(false)),
            stt_provider: None,
            deepgram_api_key: None,
            keepawake: None,
        }
    }
}

/// Clone under the app lock; acquire the pipeline lock only after this returns.
pub fn detection_pipeline(
    state: &Mutex<AppState>,
) -> Result<Arc<Mutex<DetectionPipeline>>, String> {
    Ok(Arc::clone(
        &state.lock().map_err(|e| e.to_string())?.detection_pipeline,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rhema_detection::semantic::{
        embedder::TextEmbedder,
        index::{SearchResult, VectorIndex},
    };
    use std::sync::{mpsc, Mutex};
    use std::time::Duration;
    struct BlockingEmbedder {
        entered: mpsc::Sender<()>,
        release: Mutex<mpsc::Receiver<()>>,
    }
    impl TextEmbedder for BlockingEmbedder {
        fn embed(&self, _: &str) -> Result<Vec<f32>, rhema_detection::DetectionError> {
            self.entered.send(()).unwrap();
            self.release
                .lock()
                .unwrap()
                .recv_timeout(Duration::from_secs(5))
                .unwrap();
            Ok(vec![1.0])
        }
        fn dimension(&self) -> usize {
            1
        }
    }
    struct EmptyResultIndex;
    impl VectorIndex for EmptyResultIndex {
        fn search(
            &self,
            _: &[f32],
            _: usize,
        ) -> Result<Vec<SearchResult>, rhema_detection::DetectionError> {
            Ok(vec![])
        }
        fn len(&self) -> usize {
            1
        }
    }
    #[test]
    fn inference_does_not_hold_the_app_state_lock() {
        let state = Arc::new(Mutex::new(AppState::new()));
        let pipeline = detection_pipeline(&state).unwrap();
        let (entered_tx, entered_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel();
        pipeline
            .lock()
            .unwrap()
            .set_semantic(rhema_detection::SemanticDetector::new(
                Box::new(BlockingEmbedder {
                    entered: entered_tx,
                    release: Mutex::new(release_rx),
                }),
                Box::new(EmptyResultIndex),
            ));
        let worker = std::thread::spawn(move || {
            pipeline
                .lock()
                .unwrap()
                .process_semantic("a sufficiently long phrase for detection")
        });
        entered_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        let available = state.try_lock().is_ok();
        release_tx.send(()).unwrap();
        worker.join().unwrap();
        assert!(available, "Inference blocked unrelated AppState operations");
    }
}

#[cfg(test)]
mod recording_ownership_tests {
    use super::*;
    use std::sync::atomic::Ordering;
    #[test]
    fn refuses_audio_mutations_for_the_capture_owner_even_while_stopping() {
        let mut state = AppState::new();
        state.transcription_session_id = Some(7);
        state.stt_active.store(true, Ordering::SeqCst);
        assert!(state.ensure_session_audio_idle(7).is_err());
        assert!(state.ensure_session_audio_idle(8).is_ok());
        state.stt_active.store(false, Ordering::SeqCst);
        state.stt_stopping = true;
        assert!(state.ensure_session_audio_idle(7).is_err());
    }
    #[test]
    fn refuses_a_still_flushing_writer_after_the_active_flag_is_cleared() {
        let mut state = AppState::new();
        let (tx, rx) = std::sync::mpsc::channel();
        state.transcription_session_id = Some(7);
        state.capture_thread = Some(std::thread::spawn(move || {
            rx.recv().unwrap();
        }));
        let blocked = state.ensure_session_audio_idle(7).is_err();
        tx.send(()).unwrap();
        state.capture_thread.take().unwrap().join().unwrap();
        assert!(blocked);
        assert!(state.ensure_session_audio_idle(7).is_ok());
    }
}
