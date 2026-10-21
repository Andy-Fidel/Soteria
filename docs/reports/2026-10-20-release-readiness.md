# Manna desktop release plan

Research date: 20 October 2026. Scope: direct downloads for macOS and Windows, using the existing Tauri 2 application. This is a release proposal, not a completed installer test. No application code, release settings, tags, or signing keys were changed.

Follow-up on 20 October: the standard package and internal DMG were completed, followed by a Developer ID signed and notarized Apple Silicon Manna candidate. Both the app and DMG passed Gatekeeper and stapled-ticket checks; installed detection passed for KJV, NIV, and NLT. See [signed Mac package verification](../testing/signed-mac-package.md). The findings below describe the initial research state; Windows, updater delivery, and clean-machine/hardware checks remain separate work.

## Recommended first release

Ship one standard edition with the measured MiniLM local scripture detector. Keep the model, tokenizer, KJV vectors, and compatible NIV/NLT vectors together with their matching Bible database, subject to distribution permissions. Use cloud speech recognition initially. Local scripture matching does not make cloud transcription or AI summaries work offline.

Create a signed and notarized Mac DMG first. Then create a signed Windows x64 NSIS setup EXE. Include Apple Silicon Macs beyond M4 in testing. Add a separate Intel Mac build if Intel support is part of the first release; do not imply the current ARM build supports Intel. Keep local Whisper speech recognition and larger Qwen models out of the standard installer until separately tested on the intended hardware.

Users should install Manna without Bun, Rust, Python, a source checkout, or developer commands. They will still need their own supported provider credentials for cloud features unless a separate hosted billing service is introduced.

## What already exists

| Part | Current position |
| --- | --- |
| Installer automation | `.github/workflows/release.yml` builds macOS DMGs and Windows NSIS EXEs for the minimal flavor. Tags beginning with `v` can publish releases. Manual runs produce build artifacts. |
| Existing downloads | GitHub lists `v0.1.0-rc1` and `v0.1.0-rc2` as prereleases. RC2 was published on 23 May 2026. It has a 42,807,336-byte DMG, a 22,964,561-byte Windows EXE, and `latest-minimal.json`. These are older builds, not the current feature set. |
| Resources | Platform configuration files include NDI libraries. The Mac library contains both Intel and ARM64 architectures. Minimal includes the Bible database; full also references models and indexes. |
| Updates | The native updater, frontend update prompt, permission entries, public verification key, and a manifest script are present. Private-key possession and signing-account status were not checked. |
| Checks and documentation | A separate checks workflow runs frontend and desktop checks. `docs/RELEASE.md` exists, but several instructions and size estimates need replacement before use. |

The current release workflow must not be treated as proof that the current tested app can be distributed unchanged.

## Confirmed packaging gaps

### Standard downloads would lose paraphrase detection

`src-tauri/tauri.conf.minimal.json` includes only `data/rhema.db`. It does not include the working MiniLM model, tokenizer, KJV vectors, or NIV/NLT indexes. `setup:minimal` does not prepare these resources either. There is no automatic model download in the current fallback setup.

The Windows release command also passes `--no-default-features`, which removes both `whisper` and `onnx`. The workaround avoids a documented Whisper linker issue, but also removes local model inference. A standard Windows package should retain ONNX while disabling Whisper, rather than disable both. That proposed feature combination needs a real Windows build and test.

### The full configuration is not a suitable shortcut

`src-tauri/tauri.conf.full.json` references Qwen FP32, Qwen INT8, Whisper, and fallback resources. The local checkout does not contain the Qwen model graphs or Whisper model required by that configuration. The release matrix does not currently build full.

The setup recipe still centers on exporting and preparing Qwen. It does not provide a clean, versioned recipe for the exact smaller model and indexes used in recent measurements. Preparing expensive embeddings on every installer build is unnecessary. Prepare and validate an immutable resource pack once; reuse that pack in each platform build.

### Mac update downloads use the wrong format

`scripts/build-updater-manifest.py` signs a DMG and puts its URL under `darwin-aarch64`. Tauri 2's Mac updater expects an application `.tar.gz`, while the DMG remains the human-facing first-install download. The configuration also lacks `bundle.createUpdaterArtifacts: true`. Windows can reuse its NSIS EXE. Use generated update artifacts and signatures, then test an actual version-to-version upgrade. [Tauri updater documentation](https://v2.tauri.app/plugin/updater/)

The manifest loop in the release workflow also uses `installers/**/*-...` after artifacts are downloaded with `merge-multiple: true`. With Bash's default glob behavior, this pattern does not cover files directly in `installers/`. Replace it with explicit discovery and require the expected platform files. Do not silently publish a release with missing update metadata.

### Publishing is not gated by the checks workflow

Release jobs do not depend on the separate checks workflow. They build and publish on a version tag without an explicit draft review. Build a draft release from one chosen commit, finish installer checks, then publish it deliberately. Pin dependency installation with the lockfile and verify that the tag, application version, package version, and Cargo version agree.

The runbook says the aggregator publishes when a matrix build fails. The current `needs: build` job has no failure override, so that description is inaccurate. Its example also names `master`; use the actual approved release commit rather than assume a branch name.

### Signing is only partly wired

The workflow supplies Tauri updater-key environment variables. It does not configure Apple Developer ID signing/notarization or Windows publisher signing. A Tauri update signature does not replace either operating-system signature.

Keep the current public key unless there is a deliberate migration plan. Verify access to its matching private key without printing it. Existing installations need a compatible update path, or clear manual-install instructions.

## macOS delivery

Build on macOS. Sign the app with a Developer ID Application identity, submit it for Apple's notarization check, and staple the resulting approval ticket. Verify the installed app and nested libraries, including NDI and any ONNX/Whisper dependencies. Store signing material in protected CI secrets or a dedicated signing keychain. Tauri supports Apple API credentials or an Apple ID with an app-specific password. [Tauri Mac signing guide](https://v2.tauri.app/distribute/sign/macos/)

Apple Developer Program membership is US$99 per membership year, with regional pricing and possible fee waivers for eligible organizations. This is separate from Windows signing. [Apple enrollment](https://developer.apple.com/programs/enroll/)

`src-tauri/Info.plist` already explains microphone use. No entitlement file was found. Review the audio-input entitlement for the hardened signed build and test first-launch microphone permission, denial, and recovery. A development microphone test does not validate the signed app. [Apple audio-input entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.device.audio-input)

Use explicit build targets and architecture labels. Current automation has one Mac lane and the manifest assumes `darwin-aarch64`. Intel needs a separate build/update entry or a verified universal app with all native libraries available for both architectures. The current OS minimum is not an established support guarantee; derive it from the complete native dependency chain and test the chosen minimum. [GitHub runner architectures](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [Tauri Mac bundles](https://v2.tauri.app/distribute/macos-application-bundle/)

Deliver a clear drag-to-Applications DMG. Test the file after a browser download on another Mac, including offline first launch after notarization ticket stapling. Do not make removal of quarantine protections the normal install instructions.

## Windows delivery

Use an NSIS setup EXE first. Build on Windows with an explicit x64 target. Prefer per-user installation for the first edition, unless shared-computer deployment requires a separate machine-wide option. MSI can follow if churches need managed installation. Tauri supports both formats. [Tauri Windows installer guide](https://v2.tauri.app/distribute/windows-installer/)

WebView2 is the browser runtime used by the Windows interface. The default bootstrapper can download it if missing. For installations with unreliable internet, offer an offline installer variant that includes its installer. Tauri estimates roughly 127 MB extra for that option; measure the actual result. An offline WebView2 installer does not make cloud transcription offline. [Tauri WebView2 options](https://v2.tauri.app/distribute/windows-installer/#webview2-installation-options)

Check all native runtime dependencies after restoring ONNX. ONNX Runtime documents a Visual C++ runtime requirement on Windows. Inspect the built EXE/DLL imports to determine which redistributables the chosen build actually needs; do not assume WebView2 covers them. Confirm that packaged NDI and inference libraries load without developer tools. Use CPU inference as the baseline, without requiring CUDA or a dedicated GPU. [ONNX Runtime requirements](https://onnxruntime.ai/docs/install/)

Sign and timestamp the EXE and installer with a publicly trusted publisher certificate. Signing identifies the publisher; a new signed app can still trigger SmartScreen reputation warnings. Do not promise that an EV certificate removes warnings immediately. [Tauri Windows signing guide](https://v2.tauri.app/distribute/sign/windows/)

Microsoft Artifact Signing Public Trust currently lists supported countries that do not include Ghana. Individual onboarding is limited to the US and Canada. Choose a provider only after confirming eligibility for the actual publishing person or organization. A conventional certificate authority may be the practical route; obtain a current quote and check CI signing support. [Microsoft eligibility](https://learn.microsoft.com/en-us/azure/artifact-signing/quickstart#prerequisites)

Treat Windows 11 x64, an older Intel/AMD CPU, integrated graphics, 8 GB RAM, and an SSD as the first practical test profile. This is a proposed test target, not a proven minimum specification. Test 4 GB machines separately. Do not infer Windows performance from M4 results. Windows 10, Windows ARM, and 32-bit support need separate decisions and validation.

## Download size and resource handling

Measured local uncompressed files on the research date:

| Resource | Size |
| --- | ---: |
| Current Bible database | 98.29 MiB |
| MiniLM model | 86.22 MiB |
| KJV MiniLM vectors | 45.56 MiB |
| NIV and NLT MiniLM vectors together | about 91.09 MiB |
| Database plus model, tokenizer, three indexes, IDs and optional-index manifests | 322.32 MiB |

The last row excludes the executable, NDI library, frontend assets, native runtime files, and installer overhead. It is neither a compressed installer estimate nor a RAM measurement. The existing public folder totals 34.40 MiB; some of those files become compressed frontend resources. Measure the actual signed installer before advertising a download size.

Include the small detector in the standard installer first. This keeps first-run behavior predictable and works without a first-run model download. Later, an optional model manager could download larger packs into application data with version checks, checksums, safe temporary files, cancellation, and recovery. That manager does not exist today.

Generate resource packs from one exact database/model combination. Freeze the database and row IDs, tokenizer, embedding model, translation vectors, and provenance manifests together. The minimal setup currently downloads four source translations, whereas the development database includes more translations. Recreating a different database and attaching development vectors risks missing or incompatible IDs. Validate verse counts, model hashes, and known reference/quotation/paraphrase results before release.

Do not ship both Qwen model sizes, Whisper, and MiniLM simply because a full config lists them. GitHub release assets must each be smaller than 2 GiB, so large optional packs also need a size plan. [GitHub release limits](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases#storage-and-bandwidth-quotas)

## Installed data and production checks

The Bible loader opens the resource database with a read/write SQLite connection and requests WAL journal mode. A signed Mac app bundle and a machine-wide Windows installation must not rely on writable resource directories. This is a packaging risk identified from the code, not a reproduced installer failure. Test it under a standard account. Choose a read-only shipped Bible database or an explicit versioned copy in application data. Keep session databases, recordings, settings, and imported assets in writable user data.

`resolve_resource` falls back to the source checkout when a bundled file is missing. This can conceal packaging errors on the development machine. Installer tests must run where that checkout and its models are inaccessible. Missing advertised resources should fail a release check rather than silently weaken detection.

Keep the application identifier stable across upgrades. Confirm which user-data directories are retained during updates and uninstall. Test database migrations with an older saved session, a service plan, a recording, and archived slides. Do not distribute local settings, provider keys, transcripts, recordings, `.env` files, or development profiles. Verify that fresh Church Profile settings show neutral defaults.

Review production feature flags such as `devtools`, fallback environment loading, and all native library dependencies. These are review items; no unnecessary change to working presentation behavior is proposed by this report.

## Distribution permissions

Confirm rights for the complete included Bible translations before distributing their text and derived search packs. Biblica's general quotation allowance is limited and its new express-license route excludes AI/ML applications. Tyndale's published quotation allowance is also limited; it does not itself establish permission to ship a complete NLT database. Record the applicable licenses or written permissions rather than assume that a GitHub download grants redistribution rights. Review other included translations too. [Biblica permissions](https://www.biblica.com/permissions/), [Tyndale permissions](https://www.tyndale.com/permissions)

MiniLM's model page identifies the model as Apache-2.0. Include its required license/notice information with the exact model pack. Review Rust/frontend third-party notices and the existing upstream application license. [MiniLM publisher model card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)

NDI redistribution carries its own license, attribution, and linking requirements. The download script uses third-party repository copies; establish a pinned, documented runtime source and version for releases. Confirm the terms for the exact redistributed libraries. [NDI licensing](https://docs.ndi.video/all/developing-with-ndi/sdk/licensing), [NDI software distribution](https://docs.ndi.video/all/developing-with-ndi/sdk/software-distribution)

Check the included worship backgrounds, song/hymnal content, logos, and pastor photograph for public redistribution. A purchased background's use in a church presentation may not include permission to redistribute its source media inside a general-purpose app. Keep church-specific material optional where needed. No permission requests or external messages were sent during this research.

## Release and update flow

1. Choose a tested commit and new version; freeze one verified resource pack and its distribution permissions.
2. Build and sign installers in separate Mac and Windows jobs with locked dependencies and required tests.
3. Upload installers, genuine updater files/signatures, checksums, and release notes to a draft prerelease.
4. Complete clean-install, hardware, saved-data migration, and upgrade checks on those exact downloaded files.
5. Publish the tested prerelease to invited users, then promote a tested version to stable deliberately.

The current endpoint uses GitHub's stable `releases/latest` URL. The repository's latest-release API returned HTTP 404 during this research; the listed releases are prereleases. Give beta testing an explicit channel or use manual beta downloads first. Artifact discovery must cover both platform downloads. Version checks must reject mismatched tags and executable versions.

For a rollback, prefer a tested higher-version hotfix. Merely hiding a bad release does not undo already migrated data. Keep a backup before migration and document recovery. Test malformed update metadata, failed downloads, invalid signatures, and retry without harming the existing installation.

Manna currently asks before installing an update, but that acceptance leads to restart. Block or defer installation while a session is recording or projecting. The operator should apply an update after the service. Keep full-app updates initially; model-pack downloads and delta updates are later work.

## Required acceptance checks

| Area | Required result |
| --- | --- |
| Fresh installation | Browser-downloaded installer opens under a standard account, without developer tools or a checkout; required runtime files and microphone permission work. |
| Core service | Direct references, quotations and paraphrases work with the intended translations; queue/Bible/detections agree; highlights, songs, videos, and projector output work. |
| Hardware and load | Test actual older Windows hardware, an Apple Silicon Mac beyond M4, and Intel if offered; include a long transcript, reconnect, dual-display use, and measured startup/memory/speech delay. |
| Saved data and exports | Sessions, recordings, galleries, settings, giving details and exports persist after restart and upgrade; cancellation/failure does not remove existing data. |
| Trust and updates | OS signatures validate; Mac notarization works after browser download; update signatures reject tampering; a real older version upgrades to the candidate without interrupting a service. |

Record each tested OS/CPU/RAM, exact artifact checksum, install mode, and result. A green source test suite is necessary but does not replace installing the packaged files.

## Suggested order of implementation

First fix the standard resource pack and Windows ONNX feature selection. Then build an internal Mac DMG that proves packaged detection works without the checkout. Add Mac signing/notarization and upgrade support, followed by the Windows installer and signing. Complete the clean-machine checks before publishing broadly. Intel Mac, optional local Whisper, additional model packs, MSI, Linux, and delta updates can follow separately.

The immediate next task is release preparation for the standard MiniLM package. Signing accounts and content permissions can be checked alongside it. No public release or certificate purchase is authorized by this research alone.

## Offline Mac candidate follow-up

The signed and notarized `0.1.0-rc3` Apple Silicon candidate now includes Small English Q8, chooses Whisper for fresh installs, preserves saved speech choices, and shows a brief first-launch guide. Installed offline speech and KJV/NIV/NLT detection checks passed without paid API calls. See [the RC3 verification record](../testing/offline-mac-rc3.md) for the final artifact checksum, Apple receipts, automated coverage, and remaining hardware checks. This candidate is not a Windows or Intel Mac release.

## Offline Windows candidate follow-up

An internal x64 NSIS candidate now includes Base English, MiniLM, KJV, NIV and NLT, defaults fresh installs to Whisper, and preserves saved provider choices. Windows source tests and an installed offline speech/detection check passed. It is unsigned and has not been tested with a physical microphone or projector. The portable CPU build is still too slow for comfortable live speech in the measured Windows runner tests. Both publisher signing and CPU performance remain release blockers. The user will arrange the personal signing account for Derrick Tsorme. See [the Windows verification record](../testing/windows-offline-package.md) for the exact installer checksum, measurements and remaining checks.
