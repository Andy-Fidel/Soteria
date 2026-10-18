//! Keep ownership until the recorder and transcript workers have stopped.
use crate::state::AppState;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};

pub(super) async fn stop(state: &Mutex<AppState>, session_id: Option<i64>) -> Result<(), String> {
    stop_current(state, session_id, None).await
}

pub(super) async fn stop_current(
    state: &Mutex<AppState>,
    session_id: Option<i64>,
    expected: Option<&Arc<AtomicBool>>,
) -> Result<(), String> {
    let (capture, provider_task, transcript_task) = {
        let mut state = state.lock().map_err(|error| error.to_string())?;
        if expected.is_some_and(|expected| !Arc::ptr_eq(expected, &state.stt_active)) {
            return Ok(());
        }
        if session_id.is_some() && session_id != state.transcription_session_id {
            return Ok(());
        }
        if state.stt_stopping {
            return Err("Transcription is already stopping. Please wait.".into());
        }
        state.stt_stopping = true;
        state.stt_active.store(false, Ordering::SeqCst);
        state.audio_active.store(false, Ordering::SeqCst);
        if let Some(provider) = state.stt_provider.take() {
            provider.stop();
        }
        (
            state.capture_thread.take(),
            state.provider_task.take(),
            state.transcript_task.take(),
        )
    };
    let mut failure = None;
    if let Some(capture) = capture {
        if !matches!(
            tauri::async_runtime::spawn_blocking(move || capture.join()).await,
            Ok(Ok(()))
        ) {
            failure = Some("The recording thread did not stop cleanly.".to_string());
        }
    }
    for mut task in [provider_task, transcript_task].into_iter().flatten() {
        match tokio::time::timeout(std::time::Duration::from_secs(2), &mut task).await {
            Ok(Ok(())) => {}
            Ok(Err(error)) => failure = Some(error.to_string()),
            Err(_) => {
                task.abort();
                let _ = task.await;
                log::warn!("Cancelled a speech worker that did not stop after audio was flushed");
            }
        }
    }
    let mut state = state.lock().map_err(|error| error.to_string())?;
    state.transcription_session_id = None;
    state.stt_stopping = false;
    failure.map_or(Ok(()), Err)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn ending_another_session_does_not_stop_current_capture() {
        let mut initial = AppState::new();
        initial.transcription_session_id = Some(7);
        initial.stt_active.store(true, Ordering::SeqCst);
        let state = Mutex::new(initial);
        stop(&state, Some(8)).await.unwrap();
        let state = state.lock().unwrap();
        assert!(state.stt_active.load(Ordering::SeqCst));
        assert_eq!(state.transcription_session_id, Some(7));
    }
    #[tokio::test]
    async fn stop_waits_until_the_audio_writer_has_flushed() {
        let mut initial = AppState::new();
        initial.transcription_session_id = Some(7);
        let (release, waiting) = std::sync::mpsc::channel();
        let flushed = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        let worker_flushed = flushed.clone();
        initial.capture_thread = Some(std::thread::spawn(move || {
            waiting.recv().unwrap();
            worker_flushed.store(true, Ordering::SeqCst);
        }));
        let state = Mutex::new(initial);
        let stopping = stop(&state, Some(7));
        tokio::pin!(stopping);
        assert!(
            tokio::time::timeout(std::time::Duration::from_millis(20), &mut stopping)
                .await
                .is_err()
        );
        assert!(state.lock().unwrap().ensure_session_audio_idle(7).is_err());
        release.send(()).unwrap();
        stopping.await.unwrap();
        assert!(flushed.load(Ordering::SeqCst));
        assert!(state.lock().unwrap().ensure_session_audio_idle(7).is_ok());
    }
    #[tokio::test]
    async fn a_stalled_provider_cannot_block_session_ending() {
        let mut initial = AppState::new();
        initial.transcription_session_id = Some(7);
        initial.provider_task = Some(tauri::async_runtime::spawn(std::future::pending::<()>()));
        let state = Mutex::new(initial);
        tokio::time::timeout(std::time::Duration::from_secs(3), stop(&state, Some(7)))
            .await
            .unwrap()
            .unwrap();
        assert!(!state.lock().unwrap().stt_stopping);
    }
    #[tokio::test]
    async fn a_cancelled_startup_cannot_stop_a_new_run_of_the_same_session() {
        let mut initial = AppState::new();
        initial.transcription_session_id = Some(7);
        initial.stt_active.store(true, Ordering::SeqCst);
        let previous_run = Arc::new(AtomicBool::new(false));
        let state = Mutex::new(initial);
        stop_current(&state, Some(7), Some(&previous_run))
            .await
            .unwrap();
        assert!(state.lock().unwrap().stt_active.load(Ordering::SeqCst));
    }
}
