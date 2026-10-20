# Standard Mac package verification

Verified on 20 October 2026 on the local Apple Silicon Mac. This is an internal build, not a public release. Developer ID signing, notarization, Windows packaging, physical microphone testing, and testing on another Mac remain separate steps.

## Build result

- Installer: `src-tauri/target/release/bundle/dmg/Manna Internal_0.1.0-rc2_aarch64.dmg`
- Installed app: `/Applications/Manna Internal.app`
- Installer size: 313,708,334 bytes, or 299.18 MiB.
- Installed app files: about 436.46 MiB.
- Installer SHA256: `3b5990e6b1b707ff215dfb3967a6f8ad7a19bafb9f8e004b45740dcd5005149c`.

The internal app uses `com.manna.internal`, its own settings and session-data location, and no update endpoint. The existing Manna installation and saved sessions are separate. The version stays `0.1.0-rc2` because this is an internal packaging trial with a separate identity; no version tag or GitHub release was created.

The app has an ad-hoc signature so the local Apple Silicon build can run. This does not establish a trusted publisher or provide Apple notarization. Public signing is intentionally deferred.

## Packaged resources

| Resource | Verified contents |
| --- | --- |
| Model | MiniLM-L6-v2 ONNX, 384 dimensions, same model used for recent performance measurements |
| KJV index | 31,102 vectors |
| NIV index | 31,103 vectors, with integrity and model-provenance metadata |
| NLT index | 31,080 vectors, with integrity and model-provenance metadata |
| Database | Consistent SQLite snapshot preserving the current Bible data and verse IDs |

There are 93,285 vectors in total. The database retains the existing Bible translations; only KJV, NIV and NLT have semantic search indexes in this package. Model padding, matching thresholds, and inference behavior are unchanged. No model was regenerated or downloaded.

`data/standard-package.lock.json` pins the source files by SHA256. Preparation verifies vector sizes, ordered IDs against the matching database translation, and optional-index provenance. It snapshots SQLite into DELETE journal mode and records the staged file hashes in `standard-package.json`. The app opens Bible resources read-only. Session storage remains writable in application data.

Generated binary resources live in ignored `build-resources/standard/`. They are not committed to Git. A fresh checkout needs the matching local database/model/index files before running preparation. An authenticated or otherwise approved resource-download pipeline is future release work.

## Repeat the build

1. Run `bun run package:prepare` to validate and stage the local files.
2. Run `bun run package:mac:internal` on macOS.
3. Install and verify the resulting DMG using the command below.

```sh
python3 scripts/verify-installed-mac.py \
  'src-tauri/target/release/bundle/dmg/Manna Internal_0.1.0-rc2_aarch64.dmg' \
  --install-dir /Applications
```

The verifier refuses to overwrite an existing `Manna Internal.app`. For another verification run, supply a new empty install directory. The script mounts the DMG read-only, copies the app, detaches the image, checks the ad-hoc signature and resource hashes, then launches that installed executable from a temporary working directory.

The internal build command explicitly enables ONNX and the internal `package-check` feature while disabling default features, including Whisper. It strips Apple and updater signing variables from its child environment. It does not purchase a certificate, notarize the app, or publish anything. Normal release builds do not need the internal verification feature.

## Installed detection results

The installed executable's opt-in `--verify-package` mode runs the actual application startup and detection commands. It uses an in-memory session database, skips dotenv loading, and exits before frontend startup, settings hydration, hymnal seeding, or provider connection warm-up. It does not capture audio or call a paid service.

All of these checks passed:

| Check | Result |
| --- | --- |
| Resources | Loaded from `/Applications/Manna Internal.app/Contents/Resources`; checksums matched before and after execution; no resource database journals appeared |
| Model readiness | ONNX inference ready, KJV loaded, and startup output confirmed NIV and NLT indexes loaded at their expected counts |
| Direct reference | John 3:16 detected with correct verse text for each selected translation |
| Quotation | Exact John 3:16 text from each translation matched the expected verse |
| Paraphrase | John 3:16, Matthew 6:34 and Romans 8:28 expected results appeared in search and were accepted by the detection pipeline for all three display translations |

The paraphrases were:

1. “God loved everyone so much that he sent his only Son so believers could live forever.”
2. “Do not worry about tomorrow because tomorrow will bring its own troubles.”
3. “God is working everything together for the good of those who love him.”

Unrelated maintenance speech produced no semantic detection. The local verification results and timings are saved in ignored `artifacts/standard-mac-check.json`. The reported verification-loop time excludes app startup and is not a speech-to-screen latency benchmark.

A negative test copied the installed app to a temporary directory and removed its model. The app disabled semantic search and returned the expected verification error even though a valid model still existed in the development checkout. This confirms release builds cannot silently use development resource paths. The copied broken app was removed; the installed app was not changed. Results are in `artifacts/missing-model-check.json`.

## Installed interface check

The installed app opened normally with zero past sessions in its separate data location. In Explore mode, Context search found Romans 8:28 for the third paraphrase. Switching KJV to NIV and then NLT updated the displayed verse text correctly. This exercised the packaged web interface and native command boundary without a browser mock.

## Automated checks

- 503 frontend tests passed, plus lint and the typed production frontend build.
- 392 native tests passed with the standard package features; eight existing tests remained ignored.
- Six Python package-preparation tests passed.
- The two new Bible read-only tests failed against the old writer behavior and passed after the fix.
- One existing empty-database test fixture was updated to create its input file explicitly; it no longer relies on a reader creating a database.

Commands:

```sh
python3 -m unittest discover -s scripts -p test_standard_package.py -v
bun run test:run
bun run lint
cargo test --offline --locked --manifest-path src-tauri/Cargo.toml \
  --workspace --no-default-features --features onnx,package-check
```

The initial restricted build could not compile CoreFoundation. Running with access to the normal macOS compiler cache resolved that environment restriction. The finished DMG passed mounting, copying, signature checks, and installed execution.

## Operator check before signing work

Open **Manna Internal** from Applications. The installed copy is already open in Explore mode after the interface check. Run the following short check before moving to public signing:

1. Open Context search.
2. Enter “God is working everything together for the good of those who love him.”
3. Confirm Romans 8:28 appears.
4. Switch between KJV, NIV and NLT.
5. Confirm the verse wording changes.

Microphone-to-transcript testing needs a configured speech provider in the internal app. That hardware/provider test was not performed or implied by the generated-text checks. Do not use this single-machine result to promise Intel Mac, Windows, or lower-memory hardware support.
