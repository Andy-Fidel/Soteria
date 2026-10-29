# Offline core service operation

See [verification results and current limits](verification.md).

The core workflow is local: English transcription with Whisper; Bible lookup;
direct-reference, quotation and semantic detection; saved songs, plans and slides;
projector output; session storage, review and optional audio recording.

AI summaries, notes/title identification, sharing drafts, online content lookup,
website publishing and SMS remain optional online features. No cloud provider is
contacted merely to warm connections at app startup. Update checks are manual,
from Settings → Help while connected. Choosing a cloud speech
provider still deliberately prepares that provider's connection.

## Resource distribution decision

Core resources are bundled before deployment instead of downloaded during a
service. This costs installer size and local disk space but makes startup and
recovery independent of network access or a third-party service. Existing SQLite,
Whisper and ONNX engines remain in place; no new runtime service or dependency is
introduced. An on-demand in-app downloader was considered and deferred because it
would add interrupted-download and installation-state handling to the live app.

The pinned upstream installer is a bootstrap source, not a running dependency.
Once Soteria publishes its own verified resource archive, replace this bootstrap
pin with that archive and retain per-file validation and local-folder provisioning.

## Prepare a development checkout

On macOS, acquire the exact resource set from the pinned upstream RC3 installer:

```sh
npm run setup:offline -- --from-upstream
```

This downloads about 559 MB once. The artifact URL, size and SHA256 are pinned in
`data/offline-bootstrap.lock.json`. The installer is mounted read-only; its app is
never executed. Each Bible/model/index file is then independently checked against
the repository's resource locks. The source Bible and its published installer
snapshot have separate pinned hashes because SQLite backup changes the file header.
Provisioning preserves the already verified database byte-for-byte and rejects
journal sidecars or WAL-mode databases; it does not generate a new snapshot. Only those resource files are copied: no upstream
settings, session databases, credentials or recordings are imported.

To provision from a folder on a USB drive, local disk or mounted installer without
network access:

```sh
npm run setup:offline -- --source /path/to/Resources --platform mac
# On Windows, provide a pack containing Base English:
npm run setup:offline -- --source C:/Resources --platform windows
```

The resource directory must contain `data/rhema.db`, `models/fallback-minilm/`,
`embeddings/translation-indexes/` and the platform's `models/whisper/` model.
A verified Mac detection pack can also be used to prepare Windows resources by
explicitly permitting a one-time download of the locked Windows speech model:

```sh
npm run setup:offline -- --source /path/to/Resources --platform windows --download-speech
```

Files are staged under `build-resources/standard/`, ignored by Git. Development
builds resolve these staged files before the older checkout-root model layouts.
Run the desktop development app with `npm run tauri dev` (Rust, CMake for
Whisper, and the platform Tauri prerequisites must be installed). The default frontend hooks now use npm.

Release builds continue to resolve bundled resources only: a release cannot claim
to work because a developer happens to have models elsewhere on disk.

The setup command never silently replaces a mismatched model with a download.
Network access is limited to `--from-upstream` or `--download-speech`. Hash errors,
partial downloads and failed validation leave a previous valid pack intact.
Partial downloads are retained under the download cache with a hash-scoped name;
rerunning setup resumes them. Only a complete file matching its pinned checksum
becomes a usable cached artifact.

## Before disconnecting

1. Start the desktop app, not only Vite in a browser.
2. Open **Settings → Offline readiness** and wait for local speech to load.
3. Confirm Bible text, quotation matching, paraphrase detection and session storage
   are ready. **Use local speech** selects and persists Whisper after verification.
4. Configure and test the microphone; connect and select the projector.
5. Save all songs, images, slides and service-plan items needed for the service.
6. Disconnect internet and rehearse starting, recording, presenting, ending and
   reopening a service. Reopen the app while disconnected as well.

The pre-service checklist repeats resource checks. Bible text or session-storage
failure blocks a service before a live session is created. Optional quotation or
semantic-index failure is marked **Limited**; direct/manual scripture workflows
remain usable. A missing or corrupt Whisper model blocks local speech. Resource
checks do not capture audio or create sessions.

## Packaging

Build a complete internal offline candidate from the staged resources:

```sh
npm run package:offline
```

This requires Node/npm, Python, Rust, CMake 3.x for Whisper, and the platform's Tauri build tools. It
includes local speech, local detection and installed-package verification support;
updates are disabled for this internal candidate. It does not publish or sign a
public release. The CLI runs through Node, so this path does not require Bun.

The existing platform packaging commands validate resources again. The standard
preparation command reuses the staged pack when present. Mac offline installers
must include both the standard detection resources and the platform speech
configuration (`tauri.conf.signed.json`); Windows uses
`tauri.conf.windows-standard.json`. A generic Tauri build is not an offline
installer unless its resource configuration includes these files.

The Whisper build feature and resource set are both required. A binary built
without Whisper cannot be repaired simply by copying a speech-model file into it.
Mac packages use Small English Q8; Windows uses Base English. Speech support here
is English. Linux and Intel Mac performance/installer support require separate
validation; do not infer platform support from passing source tests.

## Intel Mac development limit

The pinned ONNX Rust dependency currently reports no prebuilt runtime for
`x86_64-apple-darwin`. A full semantic build needs a compatible externally linked
ONNX Runtime. This work does not downgrade that dependency or silently claim
paraphrase support.

To run the supported core preview on an Intel Mac without semantic inference:

```sh
npm run tauri dev -- --features whisper -- --no-default-features
```

Bible lookup, direct references, quotation matching and local speech remain in
this build; the readiness screen marks paraphrase detection **Limited**. Intel
Mac Whisper contexts use CPU for both readiness and live transcription after an
observed null-device crash in the bundled Metal backend. Realtime transcription
latency on this CPU path has not been benchmarked. Apple Silicon keeps its GPU
path. Verify throughput on the intended hardware before a live service.

New recording folders are isolated by the configured Soteria app identity, so
production, internal previews and upstream Manna do not share default session
folders. Existing absolute recording paths and explicit storage overrides remain
usable; provisioning does not move user recordings.

## Recovery

A second setup process fails on the setup lock rather than writing concurrently.
After a crashed process, confirm that no setup process is still running before
removing `build-resources/standard.setup.lock`. Downloads also have a per-artifact
`.download.lock`; the same stopped-process check applies after a crash.

When replacing a managed pack, the previous pack is renamed to `standard.previous`
until the new pack is published. A failed rename restores the old pack. If a
process dies between those operations, the next run restores the backup when the
destination is absent. If both directories remain, setup refuses to overwrite
either: validate `standard` and retain `standard.previous` until recovery is
resolved. Never delete a pack's session/user data to repair resource provisioning.

## Verification

```sh
npm run test:offline-setup
python3 -m unittest discover -s scripts -p 'test_standard_package.py'
npm run test:run -- src
npm run typecheck
npm run lint
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib commands::offline
```

Synthetic tests cover corrupt/missing resources, failed downloads, interrupted
publication, local-only readiness and unavailable native boundaries. Native
packaged-app, microphone, projector and disconnected restart checks remain
required before distributing an installer.

## Windows x64 build

The `Build Soteria Windows offline installer` workflow builds the Soteria source
on a Windows 2022 runner. Inputs are checksum-verified resources from the internal
draft resource release; the Base English speech model is independently pinned.
The resulting NSIS installer includes WebView2's offline installer and app-local
Microsoft C++ runtime DLLs. Candidate update endpoints are disabled.

The runner installs the exact EXE and checks installed speech recognition, Bible
lookup, quotation and semantic detection with a generated speech fixture. Reports
and the unsigned EXE are stored in `soteria-windows-internal-unsigned` for 14 days.
A second artifact contains release-staged filenames and checksums. No application
release is automatically published. These automated checks do not replace a real
microphone/projector rehearsal on the destination PC.
