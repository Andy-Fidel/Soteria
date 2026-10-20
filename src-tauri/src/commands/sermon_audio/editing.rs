use super::super::recording::timeline::{AudioSpan, Timeline};
use super::*;
use std::path::Path;

fn executable(name: &str) -> PathBuf {
    for prefix in ["/opt/homebrew/bin", "/usr/local/bin"] {
        let path = Path::new(prefix).join(name);
        if path.is_file() {
            return path;
        }
    }
    PathBuf::from(name)
}
async fn run(name: &str, args: &[String], seconds: u64) -> Result<std::process::Output, String> {
    let mut command = tokio::process::Command::new(executable(name));
    command.args(args).kill_on_drop(true);
    let output = tokio::time::timeout(Duration::from_secs(seconds), command.output())
        .await
        .map_err(|_| {
            "Audio processing took too long. Your original recording is unchanged.".to_string()
        })?
        .map_err(|_| {
            "Audio editing needs FFmpeg and FFprobe installed on this computer.".to_string()
        })?;
    if !output.status.success() {
        return Err("Audio processing failed. Your original recording is unchanged.".into());
    }
    Ok(output)
}
pub(super) async fn duration(path: &Path) -> Result<f64, String> {
    let output = run(
        "ffprobe",
        &[
            "-v".into(),
            "error".into(),
            "-show_entries".into(),
            "format=duration".into(),
            "-of".into(),
            "default=noprint_wrappers=1:nokey=1".into(),
            path.to_string_lossy().into_owned(),
        ],
        20,
    )
    .await?;
    let value = String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse::<f64>()
        .map_err(|_| "Could not read recording length.")?;
    if !value.is_finite() || value <= 0.0 || value > 4.0 * 3600.0 {
        return Err("Audio must be between zero and four hours long.".into());
    }
    Ok(value)
}
fn validate_cut(start: f64, end: f64, duration: f64) -> Result<(), String> {
    if !start.is_finite()
        || !end.is_finite()
        || start < 0.0
        || end > duration + 0.05
        || end - start < 3.0
    {
        return Err(
            "Choose valid cut points at least three seconds apart within the recording.".into(),
        );
    }
    Ok(())
}
fn offset(timestamp: f64, started: f64, spans: &[AudioSpan], duration: f64) -> Result<f64, String> {
    if !timestamp.is_finite() || !started.is_finite() {
        return Err("Recording timestamps are unavailable. Set cut points manually.".into());
    }
    let known: Vec<_> = spans
        .iter()
        .filter(|s| s.wall_start_ms.is_some() && s.wall_end_ms.is_some())
        .collect();
    let mut milliseconds = timestamp - started;
    if !known.is_empty() {
        milliseconds = known
            .last()
            .map_or(0.0, |s| s.audio_start_ms + s.duration_ms);
        for (index, span) in known.iter().enumerate() {
            let start = span.wall_start_ms.unwrap_or(0) as f64;
            let end = span.wall_end_ms.unwrap_or(0) as f64;
            if timestamp < start {
                milliseconds = if index == 0 && span.audio_start_ms > 0.0 {
                    (timestamp - started).min(span.audio_start_ms)
                } else {
                    span.audio_start_ms
                };
                break;
            }
            if timestamp <= end {
                milliseconds = span.audio_start_ms + (timestamp - start).min(span.duration_ms);
                break;
            }
        }
    }
    Ok((milliseconds / 1000.0).clamp(0.0, duration))
}
pub(super) fn suggestion(
    raw: &str,
    segments: &[rhema_notes::SessionTranscriptSegment],
    started: f64,
    path: &Path,
    duration: f64,
) -> Result<SuggestedCut, String> {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Answer {
        start_id: i64,
        end_id: i64,
        confidence: f64,
        reason: String,
    }
    let answer: Answer = serde_json::from_str(raw)
        .map_err(|_| "Could not read the suggested cut. Set the points manually or try again.")?;
    if !answer.confidence.is_finite()
        || answer.confidence < 0.6
        || answer.confidence > 1.0
        || answer.reason.len() > 1000
    {
        return Err(
            "The sermon boundaries are unclear. Review the recording and set the points manually."
                .into(),
        );
    }
    let start = segments
        .iter()
        .position(|s| s.id == answer.start_id && s.is_final)
        .ok_or("Invalid suggested start. Set it manually.")?;
    let end = segments
        .iter()
        .position(|s| s.id == answer.end_id && s.is_final)
        .ok_or("Invalid suggested end. Set it manually.")?;
    if start > end {
        return Err("The suggested cut points are reversed. Set them manually.".into());
    }
    let spans = Timeline::load(
        path.parent().ok_or("Invalid recording path")?,
        std::fs::metadata(path).map_err(|e| e.to_string())?.len(),
    )
    .map_err(|e| e.to_string())?
    .spans();
    let begin = (offset(
        segments[start].timestamp_ms as f64,
        started,
        &spans,
        duration,
    )? - 4.0)
        .max(0.0);
    let finish = if let Some(next) = segments.get(end + 1) {
        (offset(next.timestamp_ms as f64, started, &spans, duration)? + 3.0).min(duration)
    } else {
        duration
    };
    validate_cut(begin, finish, duration)?;
    Ok(SuggestedCut {
        start_seconds: begin,
        end_seconds: finish,
        reason: answer.reason,
    })
}
pub(super) async fn prepare(source: &Path, start: f64, end: f64) -> Result<PreparedAudio, String> {
    let input_duration = duration(source).await?;
    validate_cut(start, end, input_duration)?;
    let original = fingerprint(source)?;
    let mut prepared = PreparedAudio {
        revision: uuid::Uuid::new_v4().simple().to_string(),
        start_seconds: start,
        end_seconds: end,
        duration_seconds: end - start,
        bytes: 0,
        source_bytes: original.0,
        source_modified: original.1,
    };
    let output = prepared_path(source, &prepared)?;
    let args = vec![
        "-v".into(),
        "error".into(),
        "-nostdin".into(),
        "-n".into(),
        "-ss".into(),
        start.to_string(),
        "-i".into(),
        source.to_string_lossy().into_owned(),
        "-t".into(),
        (end - start).to_string(),
        "-vn".into(),
        "-map_metadata".into(),
        "-1".into(),
        "-ac".into(),
        "1".into(),
        "-ar".into(),
        "24000".into(),
        "-af".into(),
        format!(
            "loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.08,afade=t=out:st={}:d=0.12",
            (end - start - 0.12).max(0.0)
        ),
        "-codec:a".into(),
        "libmp3lame".into(),
        "-b:a".into(),
        "48k".into(),
        output.to_string_lossy().into_owned(),
    ];
    if let Err(error) = run("ffmpeg", &args, 600).await {
        let _ = std::fs::remove_file(&output);
        return Err(error);
    }
    if fingerprint(source)? != original {
        let _ = std::fs::remove_file(&output);
        return Err("The recording changed during editing. Prepare it again.".into());
    }
    prepared.duration_seconds = duration(&output).await?;
    prepared.bytes = std::fs::metadata(&output).map_err(|e| e.to_string())?.len();
    if prepared.bytes == 0 || prepared.bytes > 96 * 1024 * 1024 {
        let _ = std::fs::remove_file(&output);
        return Err("The prepared audio is empty or too large.".into());
    }
    let path = manifest(source)?;
    let temp = path.with_extension(format!("{}.tmp", prepared.revision));
    let bytes = serde_json::to_vec(&prepared).map_err(|e| e.to_string())?;
    std::fs::write(&temp, bytes)
        .and_then(|()| std::fs::rename(&temp, &path))
        .map_err(|e| e.to_string())?;
    Ok(prepared)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_cuts() {
        for (start, end) in [
            (f64::NAN, 5.0),
            (-1.0, 5.0),
            (7.0, 4.0),
            (0.0, 11.0),
            (1.0, 2.0),
        ] {
            assert!(validate_cut(start, end, 10.0).is_err());
        }
        assert!(validate_cut(1.0, 9.0, 10.0).is_ok());
    }
    #[test]
    fn maps_pauses_to_recorded_audio_and_bounds_offsets() {
        let spans = vec![
            AudioSpan {
                wall_start_ms: Some(10000),
                wall_end_ms: Some(20000),
                audio_start_ms: 0.0,
                duration_ms: 10000.0,
            },
            AudioSpan {
                wall_start_ms: Some(40000),
                wall_end_ms: Some(50000),
                audio_start_ms: 10000.0,
                duration_ms: 10000.0,
            },
        ];
        assert_eq!(offset(45000.0, 10000.0, &spans, 20.0).unwrap(), 15.0);
        assert_eq!(offset(30000.0, 10000.0, &spans, 20.0).unwrap(), 10.0);
        assert_eq!(offset(80000.0, 10000.0, &spans, 20.0).unwrap(), 20.0);
    }
    #[tokio::test]
    #[ignore = "Requires installed FFmpeg; uses generated test audio only"]
    async fn exports_a_separate_compressed_copy_and_preserves_original() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("audio.mp3");
        run(
            "ffmpeg",
            &[
                "-v".into(),
                "error".into(),
                "-f".into(),
                "lavfi".into(),
                "-i".into(),
                "sine=frequency=440:duration=8".into(),
                "-codec:a".into(),
                "libmp3lame".into(),
                source.to_string_lossy().into_owned(),
            ],
            20,
        )
        .await
        .unwrap();
        let original = std::fs::read(&source).unwrap();
        let export = prepare(&source, 1.0, 7.0).await.unwrap();
        assert_eq!(std::fs::read(&source).unwrap(), original);
        assert!((export.duration_seconds - 6.0).abs() < 0.3);
        assert!(load_prepared(&source).unwrap().is_some());
        std::fs::write(&source, b"changed").unwrap();
        assert!(load_prepared(&source).unwrap().is_none());
    }
    #[test]
    fn accepts_only_ordered_real_transcript_ids_and_keeps_boundary_buffers() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("audio.mp3");
        std::fs::write(&path, b"recording bytes").unwrap();
        let segments: Vec<_> = [(1, 11000), (2, 21000), (3, 31000)]
            .into_iter()
            .map(|(id, timestamp)| rhema_notes::SessionTranscriptSegment {
                id,
                session_id: 1,
                text: "Teaching".into(),
                is_final: true,
                confidence: 0.9,
                timestamp_ms: timestamp,
                speaker_label: None,
            })
            .collect();
        let selected = suggestion(
            r#"{"startId":1,"endId":2,"confidence":0.9,"reason":"Teaching follows worship."}"#,
            &segments,
            1000.0,
            &path,
            90.0,
        )
        .unwrap();
        assert_eq!(selected.start_seconds, 6.0);
        assert_eq!(selected.end_seconds, 33.0);
        for answer in [
            r#"{"startId":99,"endId":2,"confidence":0.9,"reason":"Wrong ID"}"#,
            r#"{"startId":2,"endId":1,"confidence":0.9,"reason":"Reversed"}"#,
            r#"{"startId":1,"endId":2,"confidence":0.2,"reason":"Unclear"}"#,
        ] {
            assert!(suggestion(answer, &segments, 1000.0, &path, 90.0).is_err());
        }
    }
}
