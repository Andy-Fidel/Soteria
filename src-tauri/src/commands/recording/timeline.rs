//! Recording provenance remains available after segment files are merged.
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub(super) const MANIFEST: &str = "audio-timeline.json";

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SampleSpan {
    wall_start_ms: u64,
    wall_end_ms: u64,
    sample_count: u64,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SegmentTiming {
    sample_rate: u32,
    spans: Vec<SampleSpan>,
}

impl SegmentTiming {
    pub(crate) fn new(sample_rate: u32) -> Self {
        Self {
            sample_rate,
            spans: Vec::new(),
        }
    }

    pub(crate) fn record_frame(&mut self, timestamp_ms: u64, samples: usize) {
        if samples == 0 || self.sample_rate == 0 {
            return;
        }
        let sample_count = u64::try_from(samples).unwrap_or(u64::MAX);
        // AudioFrame timestamps mark the end of the captured buffer.
        let duration_ms = sample_count.saturating_mul(1000) / u64::from(self.sample_rate);
        let start_ms = timestamp_ms.saturating_sub(duration_ms);
        if let Some(span) = self.spans.last_mut() {
            // Capture timestamps use whole milliseconds. Allow only that rounding
            // error; even one dropped buffer needs its own playback anchor.
            if start_ms.abs_diff(span.wall_end_ms) <= 1 {
                span.wall_end_ms = timestamp_ms;
                span.sample_count = span.sample_count.saturating_add(sample_count);
                return;
            }
        }
        self.spans.push(SampleSpan {
            wall_start_ms: start_ms,
            wall_end_ms: timestamp_ms,
            sample_count,
        });
    }

    pub(crate) fn sample_count(&self) -> u64 {
        self.spans.iter().map(|span| span.sample_count).sum()
    }

    pub(crate) fn save(&self, segment: &Path) -> std::io::Result<()> {
        write_json(&segment.with_extension("timing.json"), self)
    }

    fn duration_ms(&self) -> f64 {
        if self.sample_rate == 0 {
            return 0.0;
        }
        self.sample_count() as f64 * 1000.0 / f64::from(self.sample_rate)
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub(super) struct AudioPart {
    pub file_name: String,
    pub byte_end: u64,
    pub duration_ms: f64,
    pub timing: Option<SegmentTiming>,
}

#[derive(Default, Deserialize, Serialize)]
pub(crate) struct Timeline {
    pub(super) parts: Vec<AudioPart>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioSpan {
    pub wall_start_ms: Option<u64>,
    pub wall_end_ms: Option<u64>,
    pub audio_start_ms: f64,
    pub duration_ms: f64,
}

impl Timeline {
    pub fn load(dir: &Path, final_bytes: u64) -> std::io::Result<Self> {
        let mut timeline: Self = read_json(&dir.join(MANIFEST))?.unwrap_or_default();
        // A manifest is staged before the audio rename. Ignore uncommitted parts
        // after an interrupted concat; keep committed parts to avoid duplicate appends.
        timeline.parts.retain(|part| part.byte_end <= final_bytes);
        Ok(timeline)
    }

    pub fn save(&self, dir: &Path) -> std::io::Result<()> {
        write_json(&dir.join(MANIFEST), self)
    }

    pub fn spans(&self) -> Vec<AudioSpan> {
        let mut spans = Vec::new();
        let mut audio_start_ms = 0.0;
        for part in &self.parts {
            if let Some(timing) = &part.timing {
                let mut within_part_ms = 0.0;
                if timing.sample_rate > 0 {
                    for span in &timing.spans {
                        // A crash can leave a timing checkpoint ahead of flushed MP3
                        // bytes. Never map into the next recording part's audio.
                        let duration_ms = (span.sample_count as f64 * 1000.0
                            / f64::from(timing.sample_rate))
                        .min((part.duration_ms - within_part_ms).max(0.0));
                        spans.push(AudioSpan {
                            wall_start_ms: Some(span.wall_start_ms),
                            wall_end_ms: Some(span.wall_end_ms),
                            audio_start_ms: audio_start_ms + within_part_ms,
                            duration_ms,
                        });
                        within_part_ms += duration_ms;
                    }
                }
            } else {
                spans.push(AudioSpan {
                    wall_start_ms: None,
                    wall_end_ms: None,
                    audio_start_ms,
                    duration_ms: part.duration_ms,
                });
            }
            audio_start_ms += part.duration_ms;
        }
        spans
    }
}

pub(super) fn part_from_file(
    path: &Path,
    byte_end: u64,
    bytes: &[u8],
) -> std::io::Result<AudioPart> {
    let timing: Option<SegmentTiming> = read_json(&path.with_extension("timing.json"))?;
    let duration_ms = mp3_duration_ms(bytes)
        .unwrap_or_else(|| timing.as_ref().map_or(0.0, SegmentTiming::duration_ms));
    Ok(AudioPart {
        file_name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        byte_end,
        duration_ms,
        timing,
    })
}

fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> std::io::Result<Option<T>> {
    match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map(Some)
            .map_err(std::io::Error::other),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

fn write_json(path: &Path, value: &impl Serialize) -> std::io::Result<()> {
    let tmp: PathBuf = path.with_extension("json.tmp");
    let bytes = serde_json::to_vec(value).map_err(std::io::Error::other)?;
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(tmp, path)
}

/// Count complete Layer III frames, including encoder padding between segments.
/// Older recordings have no sample metadata, so their frame duration anchors
/// newly appended recordings without guessing from the session start time.
fn mp3_duration_ms(bytes: &[u8]) -> Option<f64> {
    let mut offset = 0;
    let mut duration = 0.0;
    while offset + 4 <= bytes.len() {
        let header = u32::from_be_bytes(bytes[offset..offset + 4].try_into().ok()?);
        let version = (header >> 19) & 3;
        let layer = (header >> 17) & 3;
        let bitrate_index = ((header >> 12) & 15) as usize;
        let rate_index = ((header >> 10) & 3) as usize;
        if header & 0xffe0_0000 != 0xffe0_0000
            || version == 1
            || layer != 1
            || bitrate_index == 0
            || bitrate_index == 15
            || rate_index == 3
        {
            offset += 1;
            continue;
        }
        let bitrates = if version == 3 {
            [
                0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320,
            ]
        } else {
            [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
        };
        let rate = [44100, 48000, 32000][rate_index]
            / match version {
                3 => 1,
                2 => 2,
                _ => 4,
            };
        let coefficient = if version == 3 { 144 } else { 72 };
        let frame_bytes =
            coefficient * bitrates[bitrate_index] * 1000 / rate + ((header >> 9) & 1) as usize;
        if offset + frame_bytes > bytes.len() {
            break;
        }
        duration += if version == 3 { 1152.0 } else { 576.0 } * 1000.0 / rate as f64;
        offset += frame_bytes;
    }
    (duration > 0.0).then_some(duration)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sample_counts_exclude_capture_gaps() {
        let mut timing = SegmentTiming::new(16_000);
        timing.record_frame(2_000, 16_000);
        timing.record_frame(3_000, 16_000);
        timing.record_frame(9_000, 16_000);
        assert_eq!(timing.sample_count(), 48_000);
        assert_eq!(timing.spans.len(), 2);
        assert_eq!(timing.spans[1].wall_start_ms, 8_000);
        assert_eq!(timing.duration_ms(), 3_000.0);
    }

    #[test]
    fn encoded_frame_duration_supports_legacy_recordings() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("audio.mp3");
        let mut writer = rhema_audio::Mp3Writer::create(&path, 16_000).unwrap();
        writer.write_samples(&vec![0; 16_000]).unwrap();
        writer.finalize().unwrap();
        let duration = mp3_duration_ms(&std::fs::read(path).unwrap()).unwrap();
        assert!(
            (1_000.0..1_200.0).contains(&duration),
            "duration={duration}"
        );
    }
    #[test]
    fn crash_checkpoint_does_not_map_past_the_encoded_audio() {
        let mut timing = SegmentTiming::new(16_000);
        timing.record_frame(2_000, 16_000);
        let timeline = Timeline {
            parts: vec![AudioPart {
                file_name: "segment.mp3".into(),
                byte_end: 1,
                duration_ms: 800.0,
                timing: Some(timing),
            }],
        };
        assert_eq!(timeline.spans()[0].duration_ms, 800.0);
    }
    #[test]
    fn repeated_short_capture_gaps_keep_individual_sample_anchors() {
        let mut timing = SegmentTiming::new(16_000);
        for frame in 0..10 {
            timing.record_frame(frame * 128 + 64, 1_024);
        }
        let timeline = Timeline {
            parts: vec![AudioPart {
                file_name: "segment.mp3".into(),
                byte_end: 1,
                duration_ms: 640.0,
                timing: Some(timing),
            }],
        };
        let spans = timeline.spans();
        assert_eq!(spans.len(), 10);
        assert_eq!(spans[5].wall_start_ms, Some(640));
        assert_eq!(spans[5].audio_start_ms, 320.0);
        assert_eq!(spans[9].audio_start_ms, 576.0);
    }

    #[test]
    fn contiguous_buffers_allow_one_millisecond_timestamp_rounding() {
        let mut timing = SegmentTiming::new(16_000);
        timing.record_frame(64, 1_024);
        timing.record_frame(129, 1_024);
        assert_eq!(timing.spans.len(), 1);
        assert_eq!(timing.sample_count(), 2_048);
    }
}
