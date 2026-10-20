# Windows offline installer candidate

Prepared 20 October 2026. Scope: Windows x64 NSIS installer with Base English, MiniLM, KJV, NIV and NLT. Mac keeps Small English Q8. This work does not publish a public release or establish low-end hardware support.

## Model and settings

`data/whisper-windows.lock.json` pins `ggml-base.en.bin` (147,964,211 bytes), SHA256 `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002`, from `ggerganov/whisper.cpp` revision `5359861c739e955e79d9a303bcbc70fb988958b1`.

The native default now chooses Whisper for Whisper-enabled Windows and Mac builds. The existing settings hydration rule remains unchanged: explicit saved providers win, and completed legacy setups or profiles with cloud credentials keep their previous implicit choice. Fresh installs get the existing short guide. Readiness loads the actual bundled platform model before reporting success. Release builds never fall back to a development copy.

## Build and dependencies

`bun run package:windows [SOURCE_DIRECTORY]` runs on an x64 Windows host in a Visual Studio developer shell. It validates the resource lock, stages to `build-resources/windows-standard`, merges the standard/Windows resource maps, includes app-local Microsoft CRT DLLs, and builds with `onnx,whisper,package-check`. It leaves Mac staging alone.

`scripts/windows-cpu.cmake` disables host-specific CPU tuning and AVX/AVX2/FMA/F16C, so Whisper does not assume those instructions exist on older low-cost processors. This conservative choice can reduce inference speed on newer CPUs. No CUDA, Vulkan or dedicated GPU is required. This does not establish a minimum CPU/RAM requirement; physical hardware measurements remain necessary.

The CMake runtime policy uses the DLL Microsoft runtime, matching the other native dependencies. `STATIC_VCRUNTIME=false` keeps Tauri from adding a conflicting static runtime. Required Microsoft runtime DLLs are copied from the build machine's redistributable directory into the installation. WebView2's bootstrapper is embedded; installation may still need internet if WebView2 is missing. See [Tauri's installer guide](https://v2.tauri.app/distribute/windows-installer/).

## Authenticated CI resources

The isolated Windows branch uses the existing Release workflow's explicit `windows_standard` manual option. The normal tag release path is separate. Only lock-listed Bible/model inputs are transferred through an unpublished draft release asset. The archive is checked by SHA256 before extraction, and each resource is checked again during preparation. No private audio, sessions, settings or credentials are uploaded.

Resource draft: `windows-build-resources-20261020-rc3`. Asset: `windows-standard-sources.zip`, 391,089,630 bytes, SHA256 `20c12d22be906d3d1055842d41d586c3b0065cdb28cd753fc10f97ac9acb6d0e`.

## Signing boundary

The user confirmed there is no Windows signing account yet. The current GitHub secrets are Tauri updater keys, not publisher certificates. The internal CI artifact is explicitly named unsigned. It must not be described as signed or ready for public distribution.

`MANNA_WINDOWS_SIGN_COMMAND` can supply a provider-specific Tauri signing command when a real publisher identity is available. `MANNA_REQUIRE_WINDOWS_SIGNING=true` rejects a missing command. The installed verifier's `--require-publisher` requires valid Authenticode signatures and the expected certificate subject on both the application and setup EXE. Actual publisher signing remains blocked until credentials are provisioned. A self-signed certificate is not a substitute.

## Verification scope

The Windows workflow runs packaging/frontend/native tests and builds an NSIS installer. It generates a local English speech fixture using Windows speech synthesis, installs into a new isolated directory, checks installed resource hashes, and runs the actual bundled Whisper provider and scripture detection. The installed process receives a PATH containing only the install directory and Windows system directories. It also loads the packaged NDI DLL and reads its version. It does not open a microphone or call a paid speech/AI provider.

Physical microphone permission/capture, projector output, SmartScreen on a browser-downloaded signed installer, and real low-end laptop performance are separate hardware/operator checks. GitHub's Windows runner is not a substitute for an HP or Lenovo laptop with limited RAM.

## Run results

Pending Windows runner completion. Do not infer success from local Mac tests.
