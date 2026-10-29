# Offline implementation verification — 29 October 2026

## Scope and outcome

Implemented resource provisioning, offline readiness, pre-service resource gates,
local-provider persistence and a complete-resource installer build command.
Summaries, AI notes/titles, online lookup, publishing and SMS remain optional
online features. Startup no longer performs cloud-host warm-up or automatic
update checks.

A real Mac resource pack was provisioned from the pinned upstream RC3 artifact.
The upstream app was not executed to obtain resources. The installer was verified,
mounted read-only, and detached after copying only pinned resource files.

## Real resource verification

- Upstream artifact: 558,655,320 bytes; SHA256
  `a0768a3f3c5448c14797a43746d33e6294e215cb2a4007471a2c19dba29cb6e8`.
- Staged pack: 12 files, 602,449,728 bytes, including Small English Q8 speech.
- Verified Bible snapshot SHA256:
  `f4df299c79e55155e12c5edfdf752c0dfb5d885f18607335a95bc898a2a5c932`.
- KJV: 31,102 indexed verses; NIV: 31,103; NLT: 31,080. Vector dimensions,
  verse IDs, database references and model/tokenizer provenance were validated.
- Re-running `npm run package:prepare` against the staged pack preserves speech
  and the exact pinned database bytes. Packaging does not re-snapshot the DB.
- The debug Mac app bundle's resource directory was independently validated
  against the pinned locks, including its speech model.

Downloads retain hash-scoped partials across interrupted setup attempts. A
completed artifact is accepted only after checksum verification. Copy-time
corruption is checked against the pinned input lock before publication; a newly
generated manifest cannot bless altered bytes. Previous packs survive failed
validation or publication.

## Automated checks

- 525 frontend tests passed; TypeScript/production build and ESLint passed.
- 21 Python provisioning/package tests passed.
- Three Node tests passed for Mac/Windows resource mapping and unsupported targets.
- Three native readiness tests and four native model-resolution tests passed in
  the build without optional inference features.
- Two opt-in native tests passed against the **packaged** resources with Whisper
  enabled: the real speech model creates a usable state; local Bible lookup,
  direct-reference detection, quotation matching and in-memory session storage
  work without speech keys or network calls.
- The Intel CPU policy regression test passed.
- Thirteen native storage tests passed, including production/preview/upstream
  recording-folder isolation and preservation of existing absolute audio paths.

The native resource tests are deliberately ignored in ordinary CI because their
large binary inputs are not in Git. Run them explicitly with a verified pack:

```sh
SOTERIA_OFFLINE_RESOURCE_DIR=/absolute/path/to/Resources \
  cargo test --offline --locked --manifest-path src-tauri/Cargo.toml \
  --no-default-features --features whisper --lib \
  commands::offline::tests::packaged_ -- --ignored
```

## Intel Mac findings and limits

The pinned ONNX dependency's default binary distribution does not provide the
runtime needed by this Intel Mac build. The full semantic desktop build therefore
remains blocked here; no library downgrade was made. Standard full-resource
Mac/Windows configurations were checked during this initial phase. The subsequent
Windows build below passed; an Apple Silicon installer has not been built in this run.

A Whisper-only Intel debug preview was built. A real model-load test exposed a
native Metal null-device dereference (`ggml_backend_metal_device_acq`). Readiness
and live Whisper contexts now both choose CPU on Intel Macs. The identical model
then loaded successfully in the native resource test. Apple Silicon's existing
GPU behavior is preserved. CPU transcription throughput has not been benchmarked.

Native UI automation did not respond reliably, so it is not counted as a passed
native screen check. The browser-only readiness screen correctly reports that
native services are unavailable and disables local-provider selection.

## Still required before a live-service release

- Resolve the compatible semantic runtime for an Intel full-feature build, or use
  a supported target with the full runtime and verify its installed engines.
- Test real microphone permissions, input, unplug/reconnect and recognition.
- Measure sustained transcription throughput and latency on the intended hardware.
- Rehearse projection, recording, ending/reopening sessions and disconnected
  restart on the actual deployment machine.
- Complete the remaining platform release builds and signing/notarization checks
  before distribution. A local debug preview is not a signed
  production release.

## Windows x64 installer — 29 October 2026

The [Windows build](https://github.com/Andy-Fidel/Soteria/actions/runs/40907092062)
succeeded at source commit `2ee83a845d7a57cc8bb671ca0a387388ef886b1c`.
It produced an unsigned NSIS installer with the Soteria logo and name, Base English
speech, MiniLM semantic detection, KJV/NIV/NLT, app-local Microsoft C++ runtime
DLLs, and WebView2's offline installer. Candidate update endpoints are disabled.

- 528 frontend tests, ESLint and the frontend production build passed on Windows.
- 411 native tests passed with `onnx,whisper,package-check` enabled.
- The exact EXE was silently installed and launched with a restricted runtime PATH.
- Installed speech recognition returned a transcript from locally generated audio.
- Installed Bible lookup, direct references, quotations and semantic detection passed.
- Resource checksums remained unchanged; the check reported no provider calls.
- Installed Microsoft runtime files and NDI library loading were checked.

The tested artifact is available as
[release-staged-windows](https://github.com/Andy-Fidel/Soteria/actions/runs/40907092062/artifacts/12913626896).
It contains the installer and `checks-windows.json`, which records the installer
checksum, source revision and full installed-app results. Artifact retention is
14 days; retain a local copy. The ZIP's SHA256 is
`bdd8c8a85eed1c4fa4e30e4496be705a79392facaec7d012b9f1f7ffed3d5185`.

This is an unsigned candidate. Physical microphone, reconnection, sustained speech
throughput, projector use and disconnected installation/restart on the destination
PC still need rehearsal. The generated-audio test does not validate microphone hardware.
