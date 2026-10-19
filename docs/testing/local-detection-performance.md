# Local detection performance

Measured 2026-10-19. This change reuses raw search results for repeated text and passes the existing original matches into the synonym/concept search. The cache remains bounded to 256 original phrases. Confidence thresholds and synonym settings are applied again on each detection. Failed searches are not cached.

## Measured result

Hardware: Apple M4 Pro, 12 CPU cores, 24 GB RAM. Release build, MiniLM-L6-v2 on CPU, KJV + NIV + NLT (93,285 vectors). These measurements do not establish performance on Windows or on low-end laptops.

Two consecutive before/after comparisons used the existing 50-phrase evaluation set. Each process searched it three times. No microphone, provider requests, or paid APIs were used.

| Measure | Before, runs 1 / 2 | After, runs 1 / 2 |
| --- | --- | --- |
| First pass, all 50 phrases | 2,552 / 2,554 ms | 2,076 / 2,080 ms |
| First pass, median phrase | 26.38 / 26.38 ms | 26.27 / 26.23 ms |
| First pass, estimated p95 | 105.00 / 104.95 ms | 80.98 / 80.94 ms |
| Second pass, median phrase | 26.18 / 26.21 ms | 0.0008 / 0.0007 ms |
| Second pass, all 50 phrases | 1,314 / 1,316 ms | 0.15 / 0.14 ms |

The first pass uses about 19% less total detection time. The largest benefit is for exactly repeated phrases while they remain in the cache. This is not a measured reduction in speech-provider latency or total speech-to-screen time. Ordinary new phrases still take about 26 ms at the median. Startup time was unchanged within run variation (about 0.86–0.90 seconds for benchmark setup, with the OS file cache already populated).

All verse IDs, order, and confidence scores matched the baseline for all 150 results per run. The set contains 25 paraphrases, five quotes, and 20 negative examples. Paraphrase accuracy remains 22/25 first matches and 25/25 in the first three matches; quotes remain 5/5 and negatives produce no hits. This small regression set does not establish accuracy for every sermon. A separate `--verify` run confirmed six NIV/NLT samples still match their stored embeddings (cosine similarity at least 0.9999996).

An initial comparison overlapped other checks and included optional parity validation; it was excluded from the timing table. The reported comparisons ran sequentially without those competing test jobs. Percentiles use the sorted value at floor(0.95 × (n − 1)).

## Repeat on Windows or Mac

From the repository root, with the existing MiniLM model, Bible database, and translation indexes installed:

1. Run `cargo test --offline --manifest-path src-tauri/Cargo.toml -p rhema-detection --features onnx,vector-search`.
2. Run `cargo build --offline --release --manifest-path src-tauri/Cargo.toml -p rhema-detection --features onnx,vector-search --example semantic_benchmark`.
3. Run `src-tauri/target/release/examples/semantic_benchmark multi` (append `.exe` on Windows).
4. Repeat the command and compare the first round separately from the repeated rounds.
5. Run the same command with `multi --verify` separately to check model/index agreement.

The benchmark copies the Bible database into a temporary folder. It does not change the source database. It loads a model probe before its first timed detector query; this is not a true cold-start or full-app benchmark.

Before promising Windows performance, repeat on an older Intel/AMD laptop with 8 GB RAM, an SSD, and no dedicated GPU. Record CPU, RAM, Windows version, power mode, and model. Measure the full app's memory and speech-to-screen delay separately, including a long service session. Treat 4 GB support as unverified until measured. Local scripture matching and fully offline speech recognition have different hardware needs.

## Regression coverage

The detector tests cover repeated searches, unchanged threshold handling, switching synonym mode, retaining variant searches, retry after a failed index search, repeated negative speech, and bounded-cache eviction. The change uses the same portable Rust path on Mac and Windows and adds no hardware-specific runtime or dependency.

## Verse lookup optimization (second step)

This step keeps exhaustive search across all 93,285 vectors. Eight independent float accumulators let the compiler use CPU vector instructions on ARM or x86. Partial selection keeps only the best k scores before sorting. No approximate index, GPU requirement, additional model, or new dependency was added. Exact score ties use stored order as the secondary key. Zero-result requests return without scanning.

The comparison baseline already includes the cache improvements above. The two optimized lookup runs used the same hardware, release settings, fixtures, and indexes as two immediately preceding baseline runs. Benchmark processes ran sequentially. Each run included 150 direct index lookups (50 distinct phrase embeddings, three passes), which bypass the detector cache and exclude inference from the lookup timer. Full detection is measured separately; only the first pass is used for new-phrase timings.

| Measure | Before, runs 1 / 2 | After, runs 1 / 2 |
| --- | --- | --- |
| Uncached lookup, median | 20.33 / 20.33 ms | 3.78 / 3.73 ms |
| Uncached lookup, estimated p95 | 26.06 / 21.16 ms | 3.96 / 3.79 ms |
| New-phrase detection, median | 26.59 / 26.35 ms | 9.87 / 9.53 ms |
| New-phrase detection, all 50 phrases | 2,107 / 2,079 ms | 868 / 741 ms |

Lookup was about 5.4 times faster. Typical new-phrase local detection used about 63% less time. This does not measure speech-service delays or the complete time from speaking to display. Windows hardware has not yet been measured; do not apply these timings to low-end Windows laptops.

All raw lookup IDs and order matched the baseline across 150 queries per run. All final detection references and order also matched across 150 detections per run. The largest absolute score change was 0.0000005961, caused by floating-point addition order. Values extremely close to a threshold can therefore differ; this is not bit-for-bit score equivalence. The same 22/25 first-match paraphrases, 25/25 top-three paraphrases, 5/5 quotes, and zero hits for 20 negative examples were retained. Six runtime/index parity checks passed separately, with similarity at least 0.9999998.

The tests compare search with an independent scalar full-sort reference across dimensions 1, 7, 8, 9, 384, and 1024. They cover k=0, k=1, k=5, near/full index lengths, oversized k, and ties at the selection boundary. Existing tests also cover empty indexes and invalid query dimensions.

To measure the lookup stage on either platform, build the benchmark as described above, then run:

```
src-tauri/target/release/examples/semantic_benchmark multi --lookup
```

Append `.exe` to the executable on Windows. The JSON `lookup_results` array records uncached index time and verse IDs/scores. The `results` array records full detector time and resolved references; round 0 contains new phrases, while rounds 1 and 2 exercise the cache. `--lookup` prepares phrase embeddings and exercises the index before detector timing, so its first detector timing is not a cold query. Keep parity validation (`multi --verify`) separate from speed comparisons.

## Quotation-index memory reduction (third step)

Measured 2026-10-19 against `3c5191b`. Removed the unused `IndexedVerse.words` field. Index construction consumes the temporary unique-word set into the shared posting lists instead of cloning each word and retaining a word set per verse. The unique-word count, posting-list contents, stop words, matching windows, scoring, thresholds, and result limits are unchanged. Embedding padding is unchanged; the ONNX embedder source hash was checked before and after.

A new `quotation_benchmark` example loads all 217,696 English verse records from a temporary database copy, builds the actual quotation matcher, and runs 80 queries: the 50 existing evaluation phrases plus 30 exact quotations sampled throughout the English corpus. The matcher omits 470 very short verses, as before. Three fresh release-build processes were measured before the production edit, then three after. Hardware: M4 Pro, 12 CPU cores, 24 GB RAM. No microphone, inference model, or provider request is used by this benchmark.

| Measure | Before (three runs) | After (three runs) |
| --- | --- | --- |
| Process peak resident memory | 265.4 / 273.4 / 273.6 MiB | 109.2 / 109.1 / 109.5 MiB |
| Process peak memory footprint | 256.2 / 255.9 / 256.2 MiB | 91.6 / 91.3 / 91.9 MiB |
| Quotation-index build | 1,131 / 1,291 / 1,110 ms | 1,017 / 1,031 / 1,033 ms |
| Database load through index ready | 1,369 / 1,485 / 1,281 ms | 1,200 / 1,213 / 1,208 ms |
| Median matching time per query | 5.83 / 5.76 / 5.76 ms | 5.51 / 5.51 / 5.61 ms |

The median process peak resident memory fell about 60% (about 164 MiB). Median index-build time fell about 9%, and database-load-through-index-ready time fell about 12%. These are component-benchmark results, not whole-app memory or full application startup measurements. The database copy is outside the startup timer. OS file caches were not cleared. Windows has not been measured; the change uses portable Rust with no new dependency or hardware requirement.

All 80 queries retained the same confidence and word-overlap score lists across all three comparisons. The 198 checked uniquely scored results above the cutoff retained their verse IDs. Exact tied rankings already vary between baseline runs because the matcher builds candidates in randomized HashMap order. The baseline itself changed tied result lists for 40–43 of 80 queries across processes. The new runs showed the same kind of tie variation; this change does not introduce a tie-order rule or promise identical order among equal-scoring verses.

The test also exposed an existing accuracy limitation: five of the 20 negative phrases produce weak quotation suggestions at confidence 0.75, before and after this change. These include announcements about phones, notebooks, meetings, and microphones. They are below the current quotation auto-queue gate of 0.85, but the native path can still emit them as suggestions. Do not confuse the earlier semantic-detector result of zero negative hits with this separate quotation matcher. Reducing weak quotation suggestions is a separate accuracy follow-up; it was not mixed into this memory change.

Two added unit tests cover repeated words (unique-word scoring) and shared posting lists after very short verses are skipped. The full native detection suite passed 160 tests with one existing local-model test ignored. Frontend verification passed 445 tests, lint, and the typed production build; the application compile check and native performance lint also passed. Existing general Rust style warnings and the frontend bundle-size warning remain.

To reproduce from the repository root:

```
cargo build --offline --release --manifest-path src-tauri/Cargo.toml -p rhema-detection --example quotation_benchmark
src-tauri/target/release/examples/quotation_benchmark
```

Append `.exe` to the executable on Windows. Use the platform's process-memory tool to measure each fresh process. On this Mac, `/usr/bin/time -l` recorded maximum resident memory and peak footprint. Raw measurements for this session are `/tmp/manna-quotation-before-{1,2,3}.{json,time}` and `/tmp/manna-quotation-after-{1,2,3}.{json,time}`; the comparison summary is `/tmp/manna-quotation-comparison.json`. Temporary raw files can be removed by the OS.
