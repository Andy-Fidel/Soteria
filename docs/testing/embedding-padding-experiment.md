# Embedding padding experiment — not adopted

Measured 2026-10-19 against commit `3c5191b`. The experiment used the actual Rust ONNX Runtime (1.24.2), not the earlier Python runtime. All candidate changes stayed in a temporary copy. No application source changes from this experiment were kept.

## Decision

Do not enable unpadded inputs by default yet. Accuracy held and speed improved, but peak memory did not improve consistently. The two-thread combined-translation benchmark used roughly 43–46 MiB more peak resident memory. Two additional allocator experiments did not produce a consistent speed-and-memory improvement. Testing an older Windows laptop remains necessary.

The doubtful assumption is that fewer input tokens automatically mean lower total peak memory. These measurements do not support that assumption. The precise cause of the whole-process memory difference is not established; this experiment includes database loading and translation-map construction as well as inference.

## Setup

Apple M4 Pro, 12 CPU cores, 24 GB RAM. CPU execution, release build, MiniLM-L6-v2 (384 dimensions). The baseline keeps fixed padding at 128 tokens. The first candidate calls `tokenizer.with_padding(None)` and retains truncation at 128. Model weights, tokenizer file, mean pooling, normalization, vector indexes, thresholds, and detection rules were unchanged.

An isolated native probe used all 50 existing evaluation phrases (25 paraphrases, five quotations, 20 negative examples). It timed 150 embedding calls per process (three passes) separately from detection. It then evaluated each phrase once with a fresh detector. KJV, NIV, and NLT were tested separately and as the production combined index. Baseline and candidate use identical settings within each mode; KJV uses its current 0.60 gate and the combined index uses 0.65. Standalone NIV/NLT checks use 0.65 for both baseline and candidate and are equivalence checks, not production accuracy comparisons between translations.

Each process loads a model and makes an initial probe before timed embedding calls. Combined detection uses all 93,285 vectors. Database access uses a temporary copy. There were no speech-provider requests, microphone use, paid API calls, or app restarts for this experiment.

Two runs each measured embedding-only and combined modes with six inference threads. Two further combined runs limited inference to two threads using a temporary probe-only override. This is not Windows emulation: it does not reproduce an older processor, Windows memory management, limited RAM, or an integrated GPU. One run each checked standalone KJV, NIV, and NLT.

`/usr/bin/time -l` measured fresh-process maximum resident memory and peak memory footprint. The memory values below are for the probe process, not Manna plus WebKit and not memory consumed solely by the AI model. The OS file cache was not cleared.

## Unpadded input without other runtime changes

| Measure | Fixed 128-token padding | Unpadded |
| --- | --- | --- |
| Embedding median, six threads | 5.59–5.61 ms | 1.87–1.88 ms |
| Combined detection median, six threads | 9.74–9.79 ms | 5.91–5.92 ms |
| Combined detection median, two threads | 10.44–10.88 ms | 5.68–6.98 ms |
| Embedding-only maximum resident memory, six threads | 203–206 MiB | 192–196 MiB |
| Combined maximum resident memory, six threads | 444–451 MiB | 445–448 MiB |
| Combined maximum resident memory, two threads | 403–407 MiB | 449–450 MiB |
| Combined peak memory footprint, two threads | 386–390 MiB | 433–434 MiB |

Short-sentence embedding was about three times faster. Typical combined detection was about 39% faster at six threads. These are local detection timings, not speaking-to-screen delay.

## Accuracy and length checks

Every standalone KJV, NIV, and NLT ranked detection list matched its padded baseline, including empty results. Both combined-mode repetitions at both thread settings also retained all ranked lists. The largest detection score difference was approximately 0.000000298. The smallest cosine similarity between padded and unpadded phrase embeddings exceeded 0.9999999999996. This is numerical equivalence within the sample, not bit-for-bit identity or a guarantee for every borderline threshold.

Combined accuracy stayed at 22/25 first-match paraphrases, 25/25 top-three paraphrases, 5/5 quotations, and zero matches for all 20 negative examples. Thirty stored verses sampled throughout each translation were compared against fresh inference: all 90 checks passed, with minimum index agreement of 0.99999964. Existing embeddings were not regenerated.

An actual-model tokenizer test failed with the baseline (the single word `God` encoded to 128 tokens) and passed with the candidate (three tokens including special tokens). It also confirmed that empty input retains its two special tokens, and a 300-word input still truncates to 128 tokens and retains the final separator. It ran only in the temporary copy.

The Qwen models are not installed here and were not tested. No unsupported fixed-shape model behavior should be changed based on this MiniLM result.

## Additional temporary runtime experiments

1. Disable ONNX memory-pattern optimization, as the installed runtime API recommends for changing input sizes. This kept the accuracy results but did not remove the two-thread memory increase.
2. Also disable the CPU arena allocator. Memory sometimes fell, but detection timings varied enough to include regressions against the baseline. It was not accepted as a default change.

These variants are exploratory, not a claim about the cause of memory growth. Neither setting was copied into the app.

## Evidence from this session

The temporary Rust probe is `src-tauri/crates/detection/examples/padding_probe.rs` inside the temporary root recorded in `/tmp/manna-padding-state.json`. It records timings, vectors for comparison, detections, and stored-index checks. The probe-only thread override is not part of production code.

- `/tmp/manna-padding-results-summary.json`: summarized baseline/unpadded comparisons.
- `/tmp/manna-padding-before-*` and `/tmp/manna-padding-after-*`: per-process JSON results and `.time` memory reports.
- `/tmp/manna-padding-no-pattern-*` and `/tmp/manna-padding-no-arena-*`: additional experiments.
- `/tmp/manna-run-padding-probe.py`: process runner.

Temporary files may be removed by the OS; the measured results and decision are retained in this document. The backed-up performance changes in `3c5191b` remain the production baseline.
