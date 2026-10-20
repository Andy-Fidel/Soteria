//! Local model comparison; consumes only prerecorded 16 kHz mono i16 PCM.
//! Decoding and VAD settings mirror whisper.rs. Reports raw output before its
//! hallucination/confidence filter; model agreement is not ground-truth accuracy.
use rhema_audio::{AudioFrame, Vad, VadConfig, VadTransition};
use serde::Deserialize;
use serde_json::json;
use std::{error::Error, fs, time::Instant};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

#[derive(Deserialize)]
struct Manifest {
    sample_rate: u32,
    channels: u32,
    clips: Vec<Clip>,
}

#[derive(Deserialize)]
struct Clip {
    label: String,
    path: String,
    source_start_s: f64,
    duration_s: f64,
}

fn split_audio(samples: &[i16]) -> Vec<Vec<i16>> {
    let mut vad = Vad::new(VadConfig {
        silence_threshold: 0.003,
        frame_threshold: 0.002,
        min_voice_frames: 3,
        ..VadConfig::default()
    });
    let mut buffer = Vec::new();
    let mut chunks = Vec::new();
    for frame in samples.chunks(1024) {
        let result = vad.process(&AudioFrame {
            samples: frame.to_vec(),
            timestamp_ms: 0,
        });
        if matches!(result.transition, Some(VadTransition::SpeechEnded)) {
            if buffer.len() >= 16_000 {
                chunks.push(std::mem::take(&mut buffer));
            } else {
                buffer.clear();
            }
        }
        for frame in result.frames {
            buffer.extend_from_slice(&frame.samples);
        }
        if buffer.len() >= 160_000 {
            chunks.push(std::mem::take(&mut buffer));
        }
    }
    if buffer.len() >= 16_000 {
        chunks.push(buffer);
    }
    chunks
}

fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 5 || !matches!(args[3].as_str(), "cpu" | "metal") {
        return Err("Usage: whisper_benchmark MODEL MANIFEST cpu|metal THREADS".into());
    }
    let manifest: Manifest = serde_json::from_slice(&fs::read(&args[2])?)?;
    if manifest.sample_rate != 16_000 || manifest.channels != 1 {
        return Err("Only 16 kHz mono audio is supported".into());
    }
    let threads: i32 = args[4].parse()?;
    if threads < 1 {
        return Err("Thread count must be positive".into());
    }
    eprintln!("CPU features: {}", whisper_rs::print_system_info());
    let started = Instant::now();
    let mut context_params = WhisperContextParameters::default();
    context_params.use_gpu(args[3] == "metal");
    let context = WhisperContext::new_with_params(&args[1], context_params)?;
    let mut state = context.create_state()?;
    let load_ms = started.elapsed().as_secs_f64() * 1000.0;
    let mut clips = Vec::new();
    for clip in &manifest.clips {
        let bytes = fs::read(&clip.path)?;
        if bytes.len() % 2 != 0 {
            return Err("Truncated i16 PCM file".into());
        }
        let samples: Vec<_> = bytes
            .chunks_exact(2)
            .map(|b| i16::from_le_bytes([b[0], b[1]]))
            .collect();
        let mut results = Vec::new();
        for (index, chunk) in split_audio(&samples).iter().enumerate() {
            let floats: Vec<_> = chunk.iter().map(|&s| f32::from(s) / 32768.0).collect();
            let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
            params.set_language(Some("en"));
            params.set_n_threads(threads);
            params.set_print_progress(false);
            params.set_print_special(false);
            params.set_print_realtime(false);
            params.set_single_segment(false);
            params.set_token_timestamps(true);
            params.set_no_speech_thold(0.4);
            params.set_suppress_blank(true);
            params.set_suppress_non_speech_tokens(true);
            eprintln!(
                "Starting {} chunk {}: {} samples, {} threads",
                clip.label,
                index,
                chunk.len(),
                threads
            );
            let inference = Instant::now();
            state.full(params, &floats)?;
            let inference_ms = inference.elapsed().as_secs_f64() * 1000.0;
            let mut text = String::new();
            let mut confidence = 0.0;
            let segments = state.full_n_segments()?;
            for segment in 0..segments {
                text.push_str(&state.full_get_segment_text(segment)?);
                let tokens = state.full_n_tokens(segment)?;
                let mut sum = 0.0;
                for token in 0..tokens {
                    sum += f64::from(state.full_get_token_prob(segment, token)?);
                }
                if tokens > 0 {
                    confidence += sum / f64::from(tokens);
                }
            }
            if segments > 0 {
                confidence /= f64::from(segments);
            }
            eprintln!("{} chunk {}: {:.0} ms", clip.label, index, inference_ms);
            let audio_seconds = f64::from(u32::try_from(chunk.len())?) / 16_000.0;
            results.push(json!({"index":index,"audio_s":audio_seconds,"inference_ms":inference_ms,"confidence":confidence,"text":text.trim()}));
        }
        clips.push(json!({"label":clip.label,"source_start_s":clip.source_start_s,"duration_s":clip.duration_s,"chunks":results}));
    }
    println!(
        "{}",
        json!({"model":args[1],"backend":args[3],"threads":threads,"model_load_ms":load_ms,"total_ms":started.elapsed().as_secs_f64()*1000.0,"clips":clips})
    );
    Ok(())
}
