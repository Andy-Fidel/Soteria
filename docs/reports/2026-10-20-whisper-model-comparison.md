# Base English versus Small English Q8

Measured locally on 20 October 2026. No installed app, default provider, or installer was changed. No audio was uploaded and no paid service was called.

## Recommendation

Use **Small English Q8 as the next default candidate for the Apple Silicon Mac package**. Base is substantially faster and smaller, but Small produced more readable wording in several excerpts and substantially fewer chunks fell below Manna's current confidence cutoff in the Metal runs. This is a practical candidate recommendation, not a verified accuracy ranking.

Do not transfer that default to low-end Windows laptops based on this test. Keep Base as the lower-resource alternative to test there. Small used about three times the CPU processing time and more process memory. A real Windows machine and a listening review are still needed before selecting a Windows default.

Both models produced questionable wording in this recording, including Bible references. Small did not consistently improve every phrase. Neither should be described as having proven accuracy for local accents: the user explicitly chose an output comparison without a corrected reference transcript. No word-error rate is reported.

## Method

- Hardware: Apple M4 Pro, 12 CPU cores, 24 GiB RAM. Each inference run used four CPU threads and ran separately at `nice 10` priority. Other normal desktop apps remained open.
- Source: the existing untrimmed 78-minute-42-second sermon recording in Downloads. Six 45-second clips started at 05:00, 15:00, 25:00, 35:00, 50:00, and 70:00. The 270 seconds were selected before inspecting either output, not chosen to favour one model.
- Audio: identical 16 kHz mono signed-i16 PCM, no volume normalization. Source and clip hashes were checked again after all runs. Local `artifacts/whisper-comparison/audio-manifest.json` records the hashes and source path.
- Engine: the project's pinned `whisper-rs 0.13.2` / `whisper-rs-sys 0.11.1`, compiled in release mode. Three Metal runs and two CPU-only runs per model, with order reversed between repetitions.
- Decoding: English, greedy `best_of: 1`, token timestamps, no-speech threshold 0.4, blank/non-speech suppression, matching `whisper.rs`. The existing VAD runs on fixed 1024-sample replay frames, minimum 1-second buffers and approximately 10-second maximum buffers. The same 52 chunks, totaling 227.76 seconds, reached both models. The rest was gated or discarded by the shared segmentation rules.

This is a replay benchmark of the inference engine and segmentation settings. It does not run microphone capture, the asynchronous live queue, or the complete application. Real microphone callback frame sizes may differ from the fixed replay frame size. Model output is recorded before the app's confidence/hallucination filter so that missing or questionable text can be inspected.

The benchmark is reproducible with `src-tauri/crates/stt/examples/whisper_benchmark.rs`:

```sh
cargo build --offline --locked --release --manifest-path src-tauri/Cargo.toml \
  -p rhema-stt --features whisper --example whisper_benchmark

/usr/bin/time -l src-tauri/target/release/examples/whisper_benchmark \
  MODEL_PATH artifacts/whisper-comparison/audio-manifest.json metal 4
```

Use `cpu` instead of `metal` for the CPU-only run. The example is feature-gated and does not change application behaviour.

## Models

Both files came from the official `ggerganov/whisper.cpp` model repository, pinned to revision `5359861c739e955e79d9a303bcbc70fb988958b1`. Their downloaded bytes matched the repository's SHA256 metadata. These are English-only models; this does not test transcription in local languages.

| Model | File size | SHA256 |
| --- | ---: | --- |
| `ggml-base.en.bin` | 147,964,211 bytes | `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002` |
| `ggml-small.en-q8_0.bin` | 264,477,561 bytes | `67a179f608ea6114bd3fdb9060e762b588a3fb3bd00c4387971be4d177958067` |

Small adds 116,513,350 bytes (about 117 MB) over Base before installer compression. These are measured model sizes, not rebuilt DMG sizes. Model provenance is saved locally in `artifacts/whisper-comparison/model-provenance.json`.

## Speed and process memory

Values are medians across three Metal runs or two CPU runs. Processing time includes context/state creation, clip reads, VAD, and inference, but not model downloading, compilation, audio conversion, or a real-time wait for someone to speak.

| Model | Metal: 270 seconds of recording | CPU-only: same recording | Metal peak process RAM | CPU peak process RAM |
| --- | ---: | ---: | ---: | ---: |
| Base English | 8.77 s | 22.57 s | 260 MiB | 381 MiB |
| Small English Q8 | 23.89 s | 66.98 s | 435 MiB | 618 MiB |

On this Mac, Base was about 2.7 times faster with Metal and 3.0 times faster without it. CPU-only inference still uses this Mac's fast ARM CPU and Apple libraries. It is not an emulation of a low-end HP or Lenovo Windows laptop.

The 95th-percentile chunk inference time was 206 ms for Base versus 685 ms for Small on Metal, and 702 ms versus 2,076 ms on CPU. Small had isolated chunks whose inference took longer than the chunk's audio duration; the overall recording still processed faster than real time. This replay does not prove live queue behaviour under load.

The first Base Metal process spent 5.78 seconds creating its context/state; subsequent model initialization was much shorter. The first Base total was 14.28 seconds, compared with 8.77 and 8.63 seconds afterward. This includes a first-use GPU initialization cost and must not be presented as a guaranteed disk-cold startup benchmark.

RAM is `/usr/bin/time -l` maximum resident set size for the benchmark process, not the whole Manna app. GPU/unified-memory allocations may not all be represented by this number. Medians and all per-run figures are saved in local `artifacts/whisper-comparison/summary.json`.

## Output differences and confidence filtering

The side-by-side output, paired with local audio clips, is saved in `artifacts/whisper-comparison/output-review.md`. Full sermon excerpts and raw model outputs are kept in ignored artifacts rather than committed to the repository.

Examples requiring a listening review:

| Excerpt | Base output | Small Q8 output | Observation, not a verified correction |
| --- | --- | --- | --- |
| 15:00 | “the question should abandon ordinary responsibilities” | “that Christians should abandon ordinary responsibilities” | Small's wording is more coherent in the surrounding church discussion. |
| 35:00 | “he has bong to it” | “he has gone through it” | Small produces a more readable phrase. |
| 35:00 | “Second Peter's of the two, which is 20” | “Second Peter 2 vs. Wendy” | Both need review; Small does not consistently preserve the verse number. |
| 50:00 | “the victory is by God” | “the witches by God” | Small has a questionable substitution in an apparent scripture quotation. |

In the three Metal runs, a mean of six Base chunks (28.55 seconds of submitted audio) fell below the app's 0.55 mean-confidence floor. Small had one such chunk (1.34 seconds). On CPU the means were four chunks / 15.18 seconds for Base and two chunks / 8.58 seconds for Small. These represent audio that the current confidence rule would discard, not a count of words lost or evidence that the remaining words are correct. Confidence calibration differs between models; higher confidence is not an accuracy score. The separate canned-hallucination denylist is not included in these counts.

The outputs include emphatic passages, audience/music cues, and wording that may correspond to non-English or prayer speech. Without listening/reference labels, errors cannot be attributed specifically to accent, noise, language switching, clipped context, or model size. This one sermon recording cannot establish general accuracy across local accents.

## Before bundling

For the current Mac candidate, proceed with Small English Q8 after reviewing the flagged audio, then test actual live microphone capture, readiness reporting, and first-run setup. The current speech code hard-codes the large-v3-turbo filename, so neither benchmark model becomes selectable merely by copying its file into the app. Enabling the Whisper build feature, packaging the chosen model, and changing fresh-install defaults remain implementation work.

Whisper currently emits completed chunks rather than streaming partial words. The live path can wait for a pause or around ten seconds of buffered audio before inference begins. The inference timings above do not include that wait. Keep this distinction visible when testing perceived responsiveness.

No new installer was built, signed, or notarized for this comparison. Existing signing work and installed apps remain unchanged.

Validation: all ten benchmark processes completed successfully; model and input hashes passed; the release harness compiled; Rust formatting and `git diff --check` passed. The speech library's Whisper-enabled release tests passed (10 tests, two existing tests ignored). Clippy's performance-error check passed; it still reports existing speech-library style warnings, with no warning in the final benchmark example.
