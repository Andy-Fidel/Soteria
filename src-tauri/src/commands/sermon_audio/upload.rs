use super::PreparedAudio;
use serde::Serialize;
use std::{path::Path, time::Duration};
use tauri::Emitter;
use tokio::io::AsyncReadExt;

const CHUNK_BYTES: usize = 3_000_000;
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PublishedAudio {
    key: String,
    bytes: u64,
    chunks: usize,
    duration_seconds: f64,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    session_id: i64,
    completed_bytes: u64,
    total_bytes: u64,
}

pub(crate) async fn upload(
    app: &tauri::AppHandle,
    session_id: i64,
    publication_id: &str,
    site: &str,
    key: &str,
    path: &Path,
    audio: &PreparedAudio,
) -> Result<PublishedAudio, String> {
    upload_chunks(
        publication_id,
        site,
        key,
        path,
        audio,
        |completed, total| {
            let _ = app.emit(
                "sermon-audio:upload-progress",
                Progress {
                    session_id,
                    completed_bytes: completed,
                    total_bytes: total,
                },
            );
        },
    )
    .await
}
async fn upload_chunks<F: FnMut(u64, u64)>(
    publication_id: &str,
    site: &str,
    key: &str,
    path: &Path,
    audio: &PreparedAudio,
    mut report: F,
) -> Result<PublishedAudio, String> {
    let reference = format!("{publication_id}-{}", audio.revision);
    let chunks = usize::try_from(audio.bytes)
        .map_err(|_| "Audio file is too large.")?
        .div_ceil(CHUNK_BYTES);
    if chunks == 0 || audio.bytes > 96 * 1024 * 1024 {
        return Err("Invalid prepared audio size.".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;
    let capability = client
        .get(format!("{site}/api/audio-capabilities"))
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|_| "Could not check website audio support. Your recording remains local.")?;
    if !capability.status().is_success() {
        return Err("The sermon website does not support audio uploads yet. Publish without new audio until the website update is deployed.".into());
    }
    let capability: serde_json::Value = capability
        .json()
        .await
        .map_err(|_| "The website returned invalid audio support information.")?;
    if capability["version"] != 1 || capability["chunkBytes"] != CHUNK_BYTES as u64 {
        return Err(
            "The website audio version is incompatible. Update the website before uploading audio."
                .into(),
        );
    }
    let mut file = tokio::fs::File::open(path)
        .await
        .map_err(|_| "The prepared audio file is missing.")?;
    let mut completed = 0;
    report(0, audio.bytes);
    for part in 0..chunks {
        let count = CHUNK_BYTES.min((audio.bytes - completed) as usize);
        let mut bytes = vec![0; count];
        file.read_exact(&mut bytes)
            .await
            .map_err(|_| "The prepared audio changed. Prepare it again.")?;
        let url = format!("{site}/api/audio-chunk?key={reference}&part={part}");
        let mut accepted = false;
        for _ in 0..2 {
            let response = client
                .post(&url)
                .bearer_auth(key)
                .header("Content-Type", "audio/mpeg")
                .body(bytes.clone())
                .send()
                .await;
            match response {
                Ok(response) if response.status().is_success() => {
                    accepted = true;
                    break;
                }
                Ok(response) if response.status().is_client_error() => {
                    return Err(format!(
                        "The website rejected the audio upload ({}). Check the website connection.",
                        response.status().as_u16()
                    ))
                }
                _ => {}
            }
        }
        if !accepted {
            return Err(
                "Audio upload stopped. Retry publishing to upload the same reviewed file.".into(),
            );
        }
        completed += count as u64;
        report(completed, audio.bytes);
    }
    Ok(PublishedAudio {
        key: reference,
        bytes: audio.bytes,
        chunks,
        duration_seconds: audio.duration_seconds,
    })
}
