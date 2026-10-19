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
