# Signed standard Mac package

Build date: 20 October 2026. Target: Apple Silicon (`aarch64-apple-darwin`). This is a local release candidate, not a published GitHub release. The version remains `0.1.0-rc2`.

## Signing setup

- Publisher: `Developer ID Application: Derrick Tsorme (Y2GQPV7SRW)`.
- The local certificate expires on 19 November 2027. Its matching private key is installed in the login Keychain.
- Notarization uses the `manna-notary` Keychain profile. No credential is read into scripts, arguments, source files, or reports.
- `src-tauri/Entitlements.plist` enables audio input for hardened runtime. The existing microphone usage description remains in `Info.plist`.
- `src-tauri/tauri.conf.signed.json` enables hardened runtime and points to that entitlement file. It does not contain an identity, password, or private key.

The internal ad-hoc build command remains separate and unchanged.

## Build and signing procedure

The standard package is prepared using `python3 scripts/prepare-standard-package.py`. The standard and signed configuration objects are merged, then passed as inline JSON to Tauri:

```text
MANNA_FLAVOR=standard bun run tauri build --ci --no-sign --bundles app \
  --config <merged standard and signed configuration JSON> \
  --features onnx,package-check -- --no-default-features --locked
```

The build process excludes inherited `APPLE_*` and `TAURI_SIGNING_PRIVATE_KEY*` variables. Signing and notarization are explicit subsequent steps, using the login Keychain and saved notarization profile. This avoids fetching any credential from Keychain into the build environment.

The generated app is copied to `artifacts/signed-mac-2026-10-20/Manna.app`. Only the generated copy has its extended attributes cleared before signing. Each native code file is signed first: `Contents/MacOS/app` and `Contents/Resources/sdk/ndi/macos/libndi.dylib`. Both receive a Developer ID signature and secure timestamp. The executable and app bundle receive the microphone entitlement and hardened runtime. The outer app is sealed last. Library validation stays enabled.

The signed app is archived with `ditto -c -k --keepParent`, submitted using `xcrun notarytool submit --keychain-profile manna-notary`, and checked for an `Accepted` result. Its ticket is attached and validated using `stapler`. The app must pass `spctl --assess --type execute` before packaging.

A compressed UDZO disk image is created with `hdiutil create` from the approved app and an `Applications` shortcut. The DMG is signed and timestamped, submitted separately to Apple, and stapled after acceptance. No app files are modified after packaging.

## Installer verification

The verifier supports the existing internal installer and the signed Manna installer. Its default behavior still verifies `Manna Internal` with the separate internal identifier. Signed verification requires the expected publisher, timestamp, hardened runtime, microphone entitlement, stapled tickets, and Gatekeeper acceptance for both the app and DMG.

```sh
python3 scripts/verify-installed-mac.py \
  artifacts/signed-mac-2026-10-20/Manna_0.1.0-rc2_aarch64.dmg \
  --app-name Manna \
  --identifier com.manna.app \
  --team-id Y2GQPV7SRW \
  --require-notarized \
  --install-dir artifacts/signed-mac-2026-10-20/installed \
  --report artifacts/signed-mac-2026-10-20/installed-check.json
```

Use a new empty install directory for another run. The verifier refuses to replace an existing app. It mounts the DMG read-only, copies the app, detaches the image, checks signing, then runs the installed executable from a temporary working directory. On this Mac, signing and Gatekeeper checks must run outside the restricted tool sandbox; restricted entitlement inspection can incorrectly report an invalid XML blob.

The `package-check` feature is intentionally included in this candidate. Its explicit `--verify-package` mode uses an in-memory session database and stops before the normal interface, saved settings, or provider startup. Normal startup still uses `com.manna.app`; this candidate is not a separate user-data profile. Existing installed apps and saved sessions are not overwritten by the verifier.

The detection checks exercise MiniLM with the bundled KJV, NIV, and NLT resources, direct references, quotations, paraphrases, and unrelated speech. Resource checksums are validated before and after execution. No paid provider is used. See `standard-mac-package.md` for the cases and model/index provenance.

## Verified result

- Installer: `artifacts/signed-mac-2026-10-20/Manna_0.1.0-rc2_aarch64.dmg`.
- Size after ticket stapling: 323,866,454 bytes (308.86 MiB).
- SHA256: `d8c282a93de5ef8a7a75aec943ab03da5e2658b7e351a26e84553af0b139b7e5`.
- App submission: `6c263bb6-5dc8-41ce-bf41-6570d74fc8fd`, accepted by Apple with no issues.
- DMG submission: `d682e7c0-74d2-4efc-b4aa-b41c64695008`, accepted by Apple with no issues.

Both stapled tickets validated. Gatekeeper accepted the app and DMG as `Notarized Developer ID`. `syspolicy_check distribution` completed successfully with no reported issues. The DMG filesystem checksum passed `hdiutil verify`.

The verifier copied Manna from the finished DMG to `artifacts/signed-mac-2026-10-20/installed/Manna.app` and passed all signing, entitlement, resource, and detection checks. It used that installed copy's resources. KJV, NIV, and NLT each passed direct references, quotations, and three paraphrase cases. Unrelated speech produced no semantic result. Resources were unchanged and no SQLite resource journals appeared. No paid provider was called.

The installed verification loop took 175.39 ms on this Mac, excluding startup; this is not a microphone-to-screen latency measurement. A separate hardened-runtime helper signed by the same publisher loaded the packaged NDI library successfully and returned NDI version `6.2.1.0`. It did not start a broadcast.

Fresh checks also passed: 503 frontend tests, 392 native tests (eight existing tests ignored), six package-preparation tests, lint, typed production build, Python syntax validation, entitlement plist validation, and `git diff --check`.

## Remaining operator checks

This verification does not establish Intel Mac or Windows compatibility. Physical microphone capture and paid speech-provider streaming need a separate operator check. Notarization establishes Apple security acceptance; it does not replace the remaining public-release work recorded in the release-readiness report.

Generated apps, archives, disk images, Apple receipts, and installed verification reports remain under ignored `artifacts/`. Private signing material remains outside the repository.
