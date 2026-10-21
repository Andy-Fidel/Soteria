# Windows offline installer candidate

Prepared 20 October 2026. Scope: Windows x64 NSIS installer with Base English, MiniLM, KJV, NIV and NLT. Mac keeps Small English Q8. This work does not publish a public release or establish low-end hardware support.

## Model and settings

`data/whisper-windows.lock.json` pins `ggml-base.en.bin` (147,964,211 bytes), SHA256 `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002`, from `ggerganov/whisper.cpp` revision `5359861c739e955e79d9a303bcbc70fb988958b1`.

The native default now chooses Whisper for Whisper-enabled Windows and Mac builds. The existing settings hydration rule remains unchanged: explicit saved providers win, and completed legacy setups or profiles with cloud credentials keep their previous implicit choice. Fresh installs get the existing short guide. Readiness loads the actual bundled platform model before reporting success. Release builds never fall back to a development copy.

## Build and dependencies

`bun run package:windows [SOURCE_DIRECTORY]` runs on an x64 Windows host in a Visual Studio developer shell. It validates the resource lock, stages to `build-resources/windows-standard`, merges the standard/Windows resource maps, includes app-local Microsoft CRT DLLs, and builds with `onnx,whisper,package-check`. It leaves Mac staging alone.

`scripts/windows-cpu.cmake` disables host-specific CPU tuning and AVX/AVX2/FMA/F16C, so Whisper does not assume those instructions exist on older low-cost processors. This conservative choice can reduce inference speed on newer CPUs. No CUDA, Vulkan or dedicated GPU is required. This does not establish a minimum CPU/RAM requirement; physical hardware measurements remain necessary.

Windows disables tokenizers’ optional `esaxx_fast` C++ training feature. Its build script hard-codes the static CRT and caused a reproduced LNK2038/LNK1319 mismatch with Whisper. Manna loads existing tokenizers rather than training them, so Windows retains the `onig` inference feature and the pure Rust trainer fallback. Non-Windows dependency features are unchanged. The resolved Windows feature tree confirms `esaxx-rs/cpp` is absent.

The CMake runtime policy uses the DLL Microsoft runtime, matching the remaining native dependencies. `STATIC_VCRUNTIME=false` keeps Tauri from adding a conflicting static runtime. Packaging explicitly rebuilds `whisper-rs-sys`, because its build script does not track our external toolchain file and could otherwise reuse stale native flags. Required Microsoft runtime DLLs are copied from the build machine's redistributable directory into the installation. WebView2's bootstrapper is embedded; installation may still need internet if WebView2 is missing. See [Tauri's installer guide](https://v2.tauri.app/distribute/windows-installer/).

## Authenticated CI resources

The isolated Windows branch uses the existing Release workflow's explicit `windows_standard` manual option. The normal tag release path is separate. Only lock-listed Bible/model inputs are transferred through an unpublished draft release asset. The archive is checked by SHA256 before extraction, and each resource is checked again during preparation. No private audio, sessions, settings or credentials are uploaded.

Resource draft: `windows-build-resources-20261020-rc3`. Asset: `windows-standard-sources.zip`, 391,089,630 bytes, SHA256 `20c12d22be906d3d1055842d41d586c3b0065cdb28cd753fc10f97ac9acb6d0e`.

## Signing boundary

The user confirmed there is no Windows signing account yet and will handle account setup personally. The publisher will be Derrick Tsorme. The current GitHub secrets are Tauri updater keys, not publisher certificates. The internal CI artifact is explicitly named unsigned. It must not be described as signed or ready for public distribution.

`MANNA_WINDOWS_SIGN_COMMAND` can supply a provider-specific Tauri signing command when a real publisher identity is available. `MANNA_REQUIRE_WINDOWS_SIGNING=true` rejects a missing command. The installed verifier's `--require-publisher` requires valid Authenticode signatures and the expected certificate subject on both the application and setup EXE. Actual publisher signing remains blocked until credentials are provisioned. A self-signed certificate is not a substitute.

## Verification scope

The Windows workflow runs packaging/frontend/native tests and builds an NSIS installer. It generates a local English speech fixture using Windows speech synthesis, installs into a new isolated directory, checks installed resource hashes, and runs the actual bundled Whisper provider and scripture detection. The installed process receives a PATH containing only the install directory and Windows system directories. It also loads the packaged NDI DLL and reads its version. It does not open a microphone or call a paid speech/AI provider.

Physical microphone permission/capture, projector output, SmartScreen on a browser-downloaded signed installer, and real low-end laptop performance are separate hardware/operator checks. GitHub's Windows runner is not a substitute for an HP or Lenovo laptop with limited RAM.

## Run results

Build run `39506010626`, source `cf92e59`, produced an unsigned NSIS installer. The Windows suite passed 395 native tests (8 ignored), 512 frontend tests, 10 packaging tests and lint. The first installed check passed native speech/detection but rejected Windows' extended path prefix when comparing directory strings. Checker commit `10077c5` uses file identity and adds three verifier tests. Installed-only run `39508528224` passed those three tests and successfully retested the exact same EXE, without rebuilding it.

Final internal file: `artifacts/windows-internal-2026-10-20/Manna_0.1.0-rc3_x64-setup-unsigned.exe`, 417,880,061 bytes (398.52 MiB), SHA256 `cc81dd52a0b003a8aff84264aeb4b443d5aeb068da80b5f1e2614050f1b5821d`. The local checksum matches the installed-test report. The adjacent `windows-installed-check.json` and `windows-native-check.json` retain the results. The installer remains unsigned; `publisher_verified` is false, and no valid Authenticode publisher identity was established.

The installed process selected Whisper by default and transcribed “John chapter 3 verse 16 For God so loved the world.” Direct references, quotations and nine paraphrase checks passed across KJV, NIV and NLT. Installed resource hashes remained unchanged, no SQLite journals appeared, the packaged NDI 6.2.1 library loaded, and the check used a restricted PATH. No paid provider calls were made. The native package check took 46.828 seconds; total external verification took 57.255 seconds. This proves offline functionality, not acceptable live speed or physical microphone/projector support.

Narrow tests with the same 5.24-second generated recording found that CMake had dropped native C/C++ optimization flags, despite Cargo reporting a release build. The Windows toolchain now explicitly restores `/O2 /Ob2 /DNDEBUG`. Diagnostic run `39503588996` verified those actual flags. With two threads, portable scalar completed in 51.573 seconds, SSE3 in 49.249 seconds and AVX2 in 4.672 seconds. Each produced “John chapter 3 verse 16” and “For God so loved the world.” Portable/SSE3 one-thread runs exceeded 60 seconds; AVX2 one-thread completed in 7.929 seconds. These are single synthetic-clip measurements, not an accent accuracy study or a hardware support guarantee.

AVX2 is a diagnostic control, not an installer requirement. The compatible build remains too slow for comfortable live use on this runner. Runtime selection of a fast CPU backend, while retaining an older-CPU fallback, needs separate implementation and measurement before a broad Windows release. Older CPUs also need a measured acceleration path; the fallback alone does not establish acceptable speed.

The publisher will be Derrick Tsorme personally. An individual code-signing certificate is required. [SSL.com IV](https://www.ssl.com/products/software-integrity/code-signing/iv/) supports personal names and cloud signing. Its advertised certificate price is $129/year, plus a separate signing subscription. Ghana-specific identity verification and the final subscription price must be confirmed before purchase. No account or purchase has been made.

## Operator check on a real laptop

1. Install the candidate under a normal Windows account and open Manna. A fresh profile should select Whisper and show the short guide; an existing profile should keep its saved provider.
2. Select and test the microphone in Settings → Audio. Start a service and say: “John chapter three verse sixteen.” Confirm transcription and the detected reference.
3. Say: “God loved everyone so much that he sent his only Son so believers could live forever.” Confirm a useful scripture result with each translation.
4. Disconnect and reconnect the microphone. Confirm that recording and detection can resume.
5. Connect a projector and run a normal service with scripture, song, highlighting and video output. Record the laptop CPU/RAM, startup time, memory use and noticeable speech delay before setting public minimum requirements.
