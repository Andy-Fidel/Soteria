# Paraphrase detection verification — 18 October 2026

The local MiniLM fallback now searches KJV, NIV and NLT. The main AppState mutex is released before waiting for inference. The speech worker and search/status commands run blocking model work off the async/UI executor.

## Baseline and fixes

The first untouched release-build measurement returned no semantic hits: the available MiniLM graph required `token_type_ids`, but runtime supplied only input IDs and attention masks. A direct real-model probe reproduced that error. The input is now supplied when required; model startup performs a real inference check before reporting semantic availability.

A working KJV-only baseline was measured after fixing that input, before enabling extra translations. Existing Qwen vectors were not mixed with MiniLM: both extra indexes were generated locally with the exact available ONNX model and tokenizer. Source lyrics, Bible wording, and the original KJV index were retained.

Each query is embedded once per search strategy, then searched across all loaded translations. A unit regression verifies one model call for a strong match across all three indexes. Canonical KJV IDs combine alternate wording into one scripture result using the best score, without adding scores together. Rare unaligned verses are omitted; adaptive over-fetching prevents them from hiding a valid candidate. Coordinates are resolved before sermon-context scoring; selected-translation text is used for display.

## Accuracy

These are developer-written text cases, not recordings or a production accuracy estimate. All results use the existing semantic detector including its synonym/concept fallback. Direct-reference and quotation detectors were not included in these accuracy counts.

| Check | KJV only | KJV + NIV + NLT |
|---|---:|---:|
| Correct first result, 25 paraphrases | 14/25 | 22/25 |
| Correct verse among first 3, 25 paraphrases | 15/25 | 25/25 |
| Correct first result, 5 quotations | 5/5 | 5/5 |
| Negative phrases producing any result, 20 cases | 0/20 | 0/20 |

The initial 30 cases calibrated a stricter multi-translation cutoff (0.65 instead of the KJV default 0.60). Two weak false matches at 0.60 disappeared. A further 20 cases were then added as validation: KJV found 6/10 paraphrases in its top 3, multi found 10/10, and neither matched any of the 10 new negative cases. No cutoff was adjusted after that validation. Similarity scores are not probabilities.

An early scoring-label mismatch (`1 Peter` versus the database's `I Peter`, and similar names) was corrected before final measurement. The raw files contain the corrected canonical labels.

## Speed and memory

Measured on this Mac with a Rust release build, MiniLM ONNX model, 384-dimensional vectors, CPU inference, three passes over 50 phrases (150 timed searches per configuration). Search timings include embedding, optional synonym/concept strategies, and vector search. They exclude speech recognition, sentence buffering, UI rendering, and live cooldown. Each process made a model-validity probe and one detector warm-up call. The database is copied outside the load timer to avoid changing its source WAL journals.

| Measurement | KJV only | KJV + NIV + NLT |
|---|---:|---:|
| Median query | 12.6 ms | 26.1 ms |
| 95th percentile query | 60.6 ms | 104.3 ms |
| Model/index startup and probe | 184.5 ms | 953.0 ms |
| Peak resident memory, standalone benchmark | 292.5 MiB | 444.5 MiB |

Extra vectors occupy about 91 MiB on disk/in memory, with additional loader/mapping overhead. Peak memory is not the complete desktop app's memory usage. Startup added about 0.77 seconds in this run. Absolute timings vary with machine load; repeated earlier runs had roughly 13/26 ms medians and 50–66/104–105 ms 95th percentiles.

Six independently checked NIV/NLT vectors (first, middle, last in each index) had runtime-to-stored-vector cosine similarity at least 0.99999964. Model/tokenizer hashes, preprocessing settings, file checksums, dimension, and count are validated before optional indexes load. Missing/corrupt/incompatible optional indexes retain KJV search.

## Reproduce

Run from the repository root:

```sh
.venv/bin/python data/prepare-translation-indexes.py --family minilm
cargo build --manifest-path src-tauri/Cargo.toml -p rhema-detection --example semantic_benchmark --features onnx,vector-search --release
/usr/bin/time -l src-tauri/target/release/examples/semantic_benchmark kjv
/usr/bin/time -l src-tauri/target/release/examples/semantic_benchmark multi
src-tauri/target/release/examples/semantic_benchmark multi --verify
```

The generator uses local model/Bible files, opens the Bible read-only, and reuses verified generated indexes. It also stages a complete MiniLM fallback under `models/fallback-minilm/` for full bundles. Optional bundle directories are tracked, but large generated model/vector assets remain ignored by Git. Use `--family qwen3` to prepare extra indexes for a Qwen-based release. Old Qwen files without provenance metadata are intentionally rejected.

## Verification and limits

- Full native suite: 286 tests passed, zero failures; the local-model test is ignored in the general suite and was explicitly run successfully.
- Frontend: 219 tests passed; TypeScript/build and ESLint passed.
- Regression coverage includes app-lock availability during blocked inference, canonical deduplication, unaligned top hits, one query embedding across translations, weak-match cutoff, selected display translation, real context coordinates, and missing/corrupt/incompatible optional resources.
- Performance-focused Clippy completed; existing advisory Rust warnings remain.
- The local model check uses actual MiniLM inference. No Qwen model was available for a comparable benchmark. Full installer packaging and a live microphone/sermon session were not tested.

Raw results are stored beside this report as `2026-10-18-semantic-kjv.json`, `2026-10-18-semantic-multi.json`, and their memory logs. Changes are uncommitted.
