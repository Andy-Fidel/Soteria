//! Audio capture and fan-out stay on one thread because cpal's stream is not Send.
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use rhema_audio::{AudioConfig, AudioFrame};
use tauri::{AppHandle, Emitter, Manager, State};

use super::recorded_segment::RecordedSegment;
use crate::events::{AudioLevelPayload, EVENT_AUDIO_LEVEL};

pub(super) struct CaptureConfig {
    pub app: AppHandle,
    pub active: Arc<AtomicBool>,
    pub recording_paused: Arc<AtomicBool>,
    pub device_id: Option<String>,
    pub gain: f32,
    pub session_dir: Option<std::path::PathBuf>,
    pub session_id: Option<i64>,
    pub audio_send_tx: crossbeam_channel::Sender<Vec<i16>>,
}

pub(super) fn spawn(config: CaptureConfig) -> std::io::Result<std::thread::JoinHandle<()>> {
    let CaptureConfig {
        app: fan_app,
        active: fan_active,
        recording_paused,
        device_id,
        gain: gain_val,
        session_dir,
        session_id,
        audio_send_tx,
    } = config;
    std::thread::Builder::new()
        .name("audio-fanout".into())
        .spawn(move || {
            let config = AudioConfig {
                device_id,
                sample_rate: 16_000,
                gain: gain_val,
            };

            let (audio_tx, audio_rx) = crossbeam_channel::bounded::<AudioFrame>(64);

            // Mint a fresh, chronologically-sortable segment path inside the
            // session dir. Returns None if recording is disabled.
            let new_segment = || -> Option<std::path::PathBuf> {
                let dir = session_dir.as_ref()?;
                let millis = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_millis())
                    .unwrap_or(0);
                // 13-digit, zero-padded so lexicographic sort == chronological.
                Some(dir.join(format!("audio-seg-{millis:013}.mp3")))
            };

            // Open the first MP3 segment if recording is enabled. Failures are
            // logged and recording is silently disabled — the transcript
            // pipeline must keep working even if disk is full or LAME init fails.
            let open_segment = || -> Option<RecordedSegment> {
                let path = new_segment()?;
                match RecordedSegment::create(&path, 16_000) {
                    Ok(w) => {
                        log::info!("[REC] recording to {}", path.display());
                        Some(w)
                    }
                    Err(e) => {
                        log::error!("[REC] Mp3Writer::create({}) failed: {e}", path.display());
                        None
                    }
                }
            };

            let mut mp3: Option<RecordedSegment> = if recording_paused.load(Ordering::SeqCst) {
                None
            } else {
                let w = open_segment();
                // If recording was requested but the first segment failed to
                // open, clear the eager audio_path so playback doesn't surface a
                // broken link.
                if w.is_none() && session_dir.is_some() {
                    if let Some(sid) = session_id {
                        let db_state: State<'_, Mutex<rhema_notes::SessionDb>> = fan_app.state();
                        if let Ok(db) = db_state.lock() {
                            let _ = db.clear_session_audio_path(sid);
                        };
                    }
                }
                w
            };

            // Start capture on THIS thread — AudioCapture stays here.
            let capture = match rhema_audio::capture::start(config, audio_tx) {
                Ok(c) => c,
                Err(e) => {
                    log::error!("Failed to start audio capture: {e}");
                    fan_active.store(false, Ordering::SeqCst);
                    return;
                }
            };

            log::info!("Audio capture started on fanout thread");

            let mut frame_count: u64 = 0;

            loop {
                if !fan_active.load(Ordering::SeqCst) {
                    break;
                }

                // Handle pause/resume transitions for recording (transcription
                // continues regardless). Paused → finalize current segment;
                // resumed → open a fresh segment. The paused interval is simply
                // absent from the recording.
                let paused = recording_paused.load(Ordering::SeqCst);
                if paused && mp3.is_some() {
                    if let Some(writer) = mp3.take() {
                        match writer.finalize() {
                            Ok(()) => log::info!("[REC] paused — segment finalized"),
                            Err(e) => log::error!("[REC] finalize on pause failed: {e}"),
                        }
                    }
                } else if !paused && mp3.is_none() && session_dir.is_some() {
                    mp3 = open_segment();
                }

                match audio_rx.recv_timeout(std::time::Duration::from_millis(100)) {
                    Ok(frame) => {
                        frame_count += 1;

                        // (a) Compute audio levels at ~15 Hz
                        //     At 16 kHz with ~1024-sample frames, every 4th frame is ~15 Hz.
                        if frame_count % 4 == 0 {
                            let level = rhema_audio::meter::compute_level(&frame.samples);
                            let _ = fan_app.emit(
                                EVENT_AUDIO_LEVEL,
                                AudioLevelPayload {
                                    rms: level.rms,
                                    peak: level.peak,
                                },
                            );
                        }

                        // Write to MP3 first (uses &frame.samples) before moving samples into STT
                        // channel, to avoid a clone.
                        if mp3.is_some() {
                            // Use `as_mut` to encode, then take + finalize on error so LAME's
                            // trailing frames are flushed instead of dropped by `Mp3Writer`'s Drop.
                            let encode_err = mp3
                                .as_mut()
                                .and_then(|writer| writer.write_frame(&frame).err());
                            if let Some(e) = encode_err {
                                log::error!("[REC] write_samples failed: {e}; disabling recording");
                                if let Some(writer) = mp3.take() {
                                    if let Err(fe) = writer.finalize() {
                                        log::error!("[REC] finalize after write error: {fe}");
                                    }
                                }
                            }
                        }

                        // (b) Forward all audio to STT provider
                        let _ = audio_send_tx.try_send(frame.samples);
                    }
                    Err(crossbeam_channel::RecvTimeoutError::Timeout) => {}
                    Err(crossbeam_channel::RecvTimeoutError::Disconnected) => break,
                }
            }

            let had_recording = mp3.is_some();
            if let Some(writer) = mp3.take() {
                match writer.finalize() {
                    Ok(()) => log::info!("[REC] MP3 finalized"),
                    Err(e) => log::error!("[REC] MP3 finalize failed: {e}"),
                }
            }
            // Signal that this segment is fully flushed/closed so the frontend's
            // finalize step can safely concatenate without racing the writer.
            if had_recording {
                let _ = fan_app.emit("recording_segment_finalized", ());
            }

            // Dropping `capture` stops the cpal stream.
            capture.stop();
            log::info!("Audio capture stopped on fanout thread");
        })
}
