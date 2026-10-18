//! Prepare DNS/TCP/TLS only. No credentials, microphone audio, or speech session.
use crate::SttError;
use std::{
    sync::OnceLock,
    time::{Duration, Instant},
};
use tokio::{net::TcpStream, sync::Mutex};
use tokio_tungstenite::MaybeTlsStream;

const MAX_AGE: Duration = Duration::from_secs(20);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);
pub(crate) type SpeechStream = MaybeTlsStream<TcpStream>;
struct Prepared<T> {
    stream: T,
    created: Instant,
}
type Slot = Mutex<Option<Prepared<SpeechStream>>>;
static DEEPGRAM: OnceLock<Slot> = OnceLock::new();
static ASSEMBLYAI: OnceLock<Slot> = OnceLock::new();

fn slot(host: &str) -> Option<&'static Slot> {
    match host {
        "api.deepgram.com" => Some(DEEPGRAM.get_or_init(|| Mutex::new(None))),
        "streaming.assemblyai.com" => Some(ASSEMBLYAI.get_or_init(|| Mutex::new(None))),
        _ => None,
    }
}
fn take_fresh<T>(value: &mut Option<Prepared<T>>, now: Instant) -> Option<T> {
    value
        .take()
        .filter(|entry| now.duration_since(entry.created) < MAX_AGE)
        .map(|entry| entry.stream)
}

/// Prepare only a supported cloud host; local Whisper needs no network socket.
pub async fn prepare(provider: &str) -> Result<bool, SttError> {
    // The deadline includes waiting for another caller's in-flight preparation.
    tokio::time::timeout(CONNECT_TIMEOUT, prepare_inner(provider))
        .await
        .map_err(|_| SttError::ConnectionFailed("Speech connection preparation timed out".into()))?
}

async fn prepare_inner(provider: &str) -> Result<bool, SttError> {
    let host = match provider {
        "deepgram" => "api.deepgram.com",
        "assemblyai" => "streaming.assemblyai.com",
        "whisper" => return Ok(false),
        _ => {
            return Err(SttError::ConnectionFailed(
                "Unsupported speech provider".into(),
            ))
        }
    };
    let cache =
        slot(host).ok_or_else(|| SttError::ConnectionFailed("Unsupported speech host".into()))?;
    let mut cached = cache.lock().await;
    if cached
        .as_ref()
        .is_some_and(|entry| entry.created.elapsed() < MAX_AGE)
    {
        return Ok(true);
    }
    *cached = None;
    let started = Instant::now();
    let stream = tokio::time::timeout(CONNECT_TIMEOUT, async {
        let connector = tokio::task::spawn_blocking(native_tls::TlsConnector::new)
            .await
            .map_err(|e| SttError::ConnectionFailed(e.to_string()))?
            .map_err(|e| SttError::ConnectionFailed(e.to_string()))?;
        let tcp = TcpStream::connect((host, 443))
            .await
            .map_err(|e| SttError::ConnectionFailed(e.to_string()))?;
        let tls = tokio_native_tls::TlsConnector::from(connector)
            .connect(host, tcp)
            .await
            .map_err(|e| SttError::ConnectionFailed(e.to_string()))?;
        Ok::<_, SttError>(MaybeTlsStream::NativeTls(tls))
    })
    .await
    .map_err(|_| SttError::ConnectionFailed("Speech connection preparation timed out".into()))??;
    let created = Instant::now();
    *cached = Some(Prepared { stream, created });
    log::info!(
        "Speech connection prepared: provider={provider}, elapsed_ms={}",
        started.elapsed().as_millis()
    );
    // One expiry task per new connection; never retain an idle socket indefinitely.
    tokio::spawn(async move {
        tokio::time::sleep(MAX_AGE).await;
        let mut cached = cache.lock().await;
        if cached
            .as_ref()
            .is_some_and(|entry| entry.created == created)
        {
            *cached = None;
        }
    });
    Ok(true)
}

pub(crate) async fn take(host: &str) -> Option<SpeechStream> {
    let mut cached = slot(host)?.lock().await;
    take_fresh(&mut cached, Instant::now())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn prepared_connection_is_consumed_once() {
        let now = Instant::now();
        let mut value = Some(Prepared {
            stream: 7,
            created: now,
        });
        assert_eq!(take_fresh(&mut value, now), Some(7));
        assert_eq!(take_fresh(&mut value, now), None);
    }
    #[test]
    fn expired_connection_is_dropped() {
        let now = Instant::now();
        let mut value = Some(Prepared {
            stream: 7,
            created: now - MAX_AGE,
        });
        assert_eq!(take_fresh(&mut value, now), None);
        assert!(value.is_none());
    }
    #[tokio::test]
    async fn preparation_deadline_includes_waiting_for_an_inflight_attempt() {
        let cache = slot("api.deepgram.com").unwrap();
        let _inflight = cache.lock().await;
        let result = tokio::time::timeout(Duration::from_secs(10), prepare("deepgram")).await;
        assert!(
            result.is_ok(),
            "Preparation exceeded its total deadline while waiting for the cache lock"
        );
        assert!(result.unwrap().is_err());
    }

    #[tokio::test]
    async fn local_and_unknown_providers_do_not_open_connections() {
        assert!(!prepare("whisper").await.unwrap());
        assert!(prepare("http://127.0.0.1").await.is_err());
        assert!(take("127.0.0.1").await.is_none());
    }
}

#[cfg(test)]
mod live_probe {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    #[tokio::test]
    #[ignore = "makes an unauthenticated TLS/HTTP request to the selected speech host"]
    async fn assemblyai_tls_is_prepared_without_a_speech_session() {
        let started = Instant::now();
        prepare("assemblyai").await.unwrap();
        let first_ms = started.elapsed().as_millis();
        let started = Instant::now();
        prepare("assemblyai").await.unwrap();
        let reused_ms = started.elapsed().as_millis();
        let mut stream = take("streaming.assemblyai.com").await.unwrap();
        stream
            .write_all(
                b"HEAD / HTTP/1.1\r\nHost: streaming.assemblyai.com\r\nConnection: close\r\n\r\n",
            )
            .await
            .unwrap();
        let mut buffer = [0u8; 128];
        let count = tokio::time::timeout(Duration::from_secs(5), stream.read(&mut buffer))
            .await
            .unwrap()
            .unwrap();
        assert!(count > 0, "Prepared TLS socket was not usable");
        assert!(buffer[..count].starts_with(b"HTTP/"));
        println!("TLS preparation first_ms={first_ms}, cached_ms={reused_ms}; unauthenticated HTTP response received");
    }
}
