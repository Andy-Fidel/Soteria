//! Offline transport recovery: synthetic PCM + scripted provider replies + real detection.
//! This does not measure speech recognition accuracy or physical device hot-plugging.
use futures_util::{FutureExt, SinkExt, StreamExt};
use rhema_audio::{
    meter::compute_level,
    vad::{Vad, VadConfig, VadState},
    AudioFrame,
};
use rhema_detection::pipeline::DetectionPipeline;
use rhema_stt::{
    ws_runtime::{run_stream, WsProvider},
    AssemblyAIClient, DeepgramClient, SttConfig, SttError, TranscriptEvent,
};
use std::{
    future::Future,
    pin::Pin,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::{net::TcpListener, sync::mpsc};
use tokio_tungstenite::tungstenite::{http::HeaderValue, Message};
use url::Url;

struct LocalSpeechServer {
    url: Url,
    parser: DeepgramClient,
    assembly_parser: AssemblyAIClient,
    assembly: bool,
}
impl LocalSpeechServer {
    fn new(address: std::net::SocketAddr, assembly: bool) -> Self {
        Self {
            url: Url::parse(&format!("ws://{address}/")).unwrap(),
            parser: DeepgramClient::new(SttConfig::default()),
            assembly_parser: AssemblyAIClient::new(SttConfig::default()),
            assembly,
        }
    }
}
impl WsProvider for LocalSpeechServer {
    fn requires_session_begin(&self) -> bool {
        self.assembly
    }
    fn log_tag(&self) -> &'static str {
        "OfflineRecoveryTest"
    }
    fn build_url(&self) -> Result<Url, SttError> {
        assert_eq!(self.url.host_str(), Some("127.0.0.1"));
        Ok(self.url.clone())
    }
    fn auth_header(&self) -> Result<Option<HeaderValue>, SttError> {
        Ok(None)
    }
    fn keepalive_frame(&self) -> Option<String> {
        None
    }
    fn close_frame(&self) -> String {
        r#"{"type":"CloseStream"}"#.into()
    }
    fn parse_message<'a>(
        &'a self,
        text: &'a str,
        tx: &'a mpsc::Sender<TranscriptEvent>,
    ) -> Pin<Box<dyn Future<Output = Result<bool, SttError>> + Send + 'a>> {
        if self.assembly {
            self.assembly_parser.parse_message(text, tx)
        } else {
            self.parser.parse_message(text, tx)
        }
    }
}
fn speech() -> Vec<i16> {
    (0..4000)
        .map(|i| if i % 32 < 16 { 6000 } else { -6000 })
        .collect()
}
async fn next_event(rx: &mut mpsc::Receiver<TranscriptEvent>) -> TranscriptEvent {
    tokio::time::timeout(Duration::from_secs(3), rx.recv())
        .await
        .expect("speech event timed out")
        .expect("speech events closed")
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn speech_silence_disconnect_reconnect_and_resumed_scripture_detection() {
    for (abrupt, assembly) in [(false, false), (true, false), (false, true), (true, true)] {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            for words in [
                "John chapter three verse sixteen",
                "Romans chapter eight verse twenty eight",
            ] {
                let (tcp, _) = listener.accept().await.unwrap();
                let mut socket = tokio_tungstenite::accept_async(tcp).await.unwrap();
                if assembly {
                    socket
                        .send(Message::Text(r#"{"type":"Begin"}"#.into()))
                        .await
                        .unwrap();
                }
                loop {
                    let frame = socket.next().await.unwrap().unwrap();
                    if let Message::Binary(bytes) = frame {
                        if bytes.iter().all(|b| *b == 0) {
                            continue;
                        }
                        let response = if assembly {
                            serde_json::json!({"type":"Turn","transcript":words,"end_of_turn":true,"end_of_turn_confidence":0.99})
                        } else {
                            serde_json::json!({"type":"Results","is_final":true,"speech_final":true,
                            "channel":{"alternatives":[{"transcript":words,"confidence":0.99,"words":[]}]}})
                        };
                        socket
                            .send(Message::Text(response.to_string().into()))
                            .await
                            .unwrap();
                        break;
                    }
                }
                if words.starts_with("John") {
                    if !abrupt {
                        socket.close(None).await.unwrap();
                    }
                    // Abrupt case drops TCP without a WebSocket close frame.
                } else {
                    while let Some(Ok(frame)) = socket.next().await {
                        if matches!(frame, Message::Close(_)) {
                            break;
                        }
                    }
                }
            }
        });
        let provider = LocalSpeechServer::new(address, assembly);
        let (audio_tx, audio_rx) = crossbeam_channel::bounded(64);
        let (event_tx, mut events) = mpsc::channel(64);
        let cancelled = Arc::new(AtomicBool::new(false));
        let stop = cancelled.clone();
        let runner =
            tokio::spawn(
                async move { run_stream(&provider, false, audio_rx, event_tx, stop).await },
            );
        let outcome =
            std::panic::AssertUnwindSafe(tokio::time::timeout(Duration::from_secs(8), async {
                assert!(matches!(
                    next_event(&mut events).await,
                    TranscriptEvent::Connected
                ));
                // Silence has real callbacks/samples, but must not invent a transcript.
                audio_tx.send(vec![0; 4000]).unwrap();
                assert!(
                    tokio::time::timeout(Duration::from_millis(150), events.recv())
                        .await
                        .is_err()
                );
                let samples = speech();
                assert!(compute_level(&samples).rms > 0.1);
                let mut vad = Vad::new(VadConfig::default());
                for _ in 0..4 {
                    vad.process(&AudioFrame {
                        samples: samples.clone(),
                        timestamp_ms: 0,
                    });
                }
                assert_eq!(vad.state(), VadState::Speech);
                audio_tx.send(samples.clone()).unwrap();
                let mut pipeline = DetectionPipeline::new();
                let TranscriptEvent::Final { transcript, .. } = next_event(&mut events).await
                else {
                    panic!("Expected pre-disconnect transcript")
                };
                let before = pipeline.process_direct(&transcript);
                assert!(before
                    .iter()
                    .any(|d| d.detection.verse_ref.book_number == 43
                        && d.detection.verse_ref.chapter == 3
                        && d.detection.verse_ref.verse_start == 16));
                assert!(
                    matches!(next_event(&mut events).await, TranscriptEvent::Reconnecting),
                    "Transient loss must reconnect without a fatal error"
                );
                assert!(matches!(
                    next_event(&mut events).await,
                    TranscriptEvent::Connected
                ));
                audio_tx.send(samples).unwrap();
                let TranscriptEvent::Final { transcript, .. } = next_event(&mut events).await
                else {
                    panic!("Expected resumed transcript")
                };
                let after = pipeline.process_direct(&transcript);
                assert!(after.iter().any(|d| d.detection.verse_ref.book_number == 45
                    && d.detection.verse_ref.chapter == 8
                    && d.detection.verse_ref.verse_start == 28));
            }))
            .catch_unwind()
            .await;
        // Always release blocking workers, including on the expected red test.
        cancelled.store(true, Ordering::SeqCst);
        drop(audio_tx);
        server.abort();
        let _ = server.await;
        let _ = tokio::time::timeout(Duration::from_secs(2), runner).await;
        assert!(
            matches!(outcome, Ok(Ok(()))),
            "Recovery failed or stalled; abrupt={abrupt}, assembly={assembly}"
        );
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn audio_source_can_close_and_restart_without_stale_workers_or_lost_detection() {
    let mut pipeline = DetectionPipeline::new();
    for (text, book) in [("John 3:16", 43), ("Romans 8:28", 45)] {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let provider = LocalSpeechServer::new(listener.local_addr().unwrap(), false);
        let server = tokio::spawn(async move {
            let (tcp, _) = listener.accept().await.unwrap();
            let mut socket = tokio_tungstenite::accept_async(tcp).await.unwrap();
            while let Some(Ok(frame)) = socket.next().await {
                match frame {
                    Message::Binary(_) => {
                        let response = serde_json::json!({"type":"Results","is_final":true,"speech_final":true,"channel":{"alternatives":[{"transcript":text,"confidence":0.99}]}});
                        socket
                            .send(Message::Text(response.to_string().into()))
                            .await
                            .unwrap();
                    }
                    Message::Close(_) => break,
                    _ => {}
                }
            }
        });
        let (audio_tx, audio_rx) = crossbeam_channel::bounded(8);
        let (event_tx, mut events) = mpsc::channel(16);
        let runner = tokio::spawn(async move {
            run_stream(
                &provider,
                false,
                audio_rx,
                event_tx,
                Arc::new(AtomicBool::new(false)),
            )
            .await
        });
        assert!(matches!(
            next_event(&mut events).await,
            TranscriptEvent::Connected
        ));
        audio_tx.send(speech()).unwrap();
        let TranscriptEvent::Final { transcript, .. } = next_event(&mut events).await else {
            panic!("Expected final transcript")
        };
        assert!(pipeline
            .process_direct(&transcript)
            .iter()
            .any(|result| result.detection.verse_ref.book_number == book));
        drop(audio_tx);
        tokio::time::timeout(Duration::from_secs(2), runner)
            .await
            .expect("audio stop stalled")
            .unwrap()
            .unwrap();
        tokio::time::timeout(Duration::from_secs(2), server)
            .await
            .unwrap()
            .unwrap();
        assert!(!matches!(
            events.try_recv(),
            Ok(TranscriptEvent::Reconnecting)
        ));
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn stop_does_not_wait_forever_for_an_unresponsive_server() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let provider = LocalSpeechServer::new(listener.local_addr().unwrap(), false);
    let server = tokio::spawn(async move {
        let (tcp, _) = listener.accept().await.unwrap();
        let _socket = tokio_tungstenite::accept_async(tcp).await.unwrap();
        std::future::pending::<()>().await;
    });
    let (_audio_tx, audio_rx) = crossbeam_channel::bounded(8);
    let (event_tx, mut events) = mpsc::channel(16);
    let cancel = Arc::new(AtomicBool::new(false));
    let worker_cancel = cancel.clone();
    let runner = tokio::spawn(async move {
        run_stream(&provider, false, audio_rx, event_tx, worker_cancel).await
    });
    assert!(matches!(
        next_event(&mut events).await,
        TranscriptEvent::Connected
    ));
    cancel.store(true, Ordering::SeqCst);
    let result = tokio::time::timeout(Duration::from_secs(2), runner).await;
    server.abort();
    let _ = server.await;
    result
        .expect("Stop must release the connection without a server acknowledgement")
        .unwrap()
        .unwrap();
}
