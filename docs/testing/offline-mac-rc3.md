# Offline Mac candidate: RC3

Prepared on 20 October 2026. This candidate keeps `com.manna.app` and changes the version to `0.1.0-rc3`. Existing installations and saved profiles are not overwritten by the verification process.

## Included speech

The signed Mac build includes Small English Q8 (`ggml-small.en-q8_0.bin`), 264,477,561 bytes, pinned to SHA256 `67a179f608ea6114bd3fdb9060e762b588a3fb3bd00c4387971be4d177958067`. The existing MiniLM model and KJV/NIV/NLT indexes remain unchanged. The Base English benchmark model and private sermon audio are not included.

`data/whisper-mac.lock.json` pins the speech resource. `bun run package:mac:signed` validates and stages both resource packs and builds with `onnx,whisper,package-check`. The existing internal build stays separate. Signing and notarization use the login Keychain and `manna-notary` profile; no credential enters the build environment.

## First launch and saved choices

The frontend waits for settings hydration before showing the workspace or guide. A fresh installation queries the native default: Whisper for this Whisper-enabled Mac build, Deepgram for builds without that capability. Explicit saved provider choices always take precedence. Existing completed setups and profiles with cloud credentials keep their previous implicit cloud default.

A short welcome dialog explains microphone permission/input testing, starting a service and presenting detected scriptures, projector selection, and optional AI keys. It does not start a microphone, open a projector, require cloud credentials, or launch a multi-step wizard. Dismissal is saved using the existing onboarding flag. Completed setups do not get the dialog again.

Whisper readiness loads the actual model and creates inference state before reporting success. Missing or unreadable models block Start Service. Release builds resolve the model only inside their app resources, with no development fallback. The speech provider emits Connected after model/state initialization, not before it.

## Automated verification

The settings regression test failed against the previous Deepgram fresh-install default, then passed with native capability selection. Tests cover all three explicit provider choices, the previous implicit default of a completed setup, missing-model readiness, and welcome hydration/dismissal. Full results: 512 frontend tests, 394 native tests (eight existing tests ignored), eight packaging tests, lint, and typed production build passed.

The package checker can now run the actual WhisperProvider on a supplied generated audio fixture. It does not open a microphone or send audio to a service. macOS's installed Samantha voice generated “John chapter three verse sixteen. For God so loved the world.” The app returned “John chapter 3 verse 16, For God so loved the world.” Its actual detection command then found John 3:16. This is a smoke test, not an accent accuracy benchmark.

Negative checks copied the candidate into a temporary directory, removed or corrupted the speech model, and confirmed nonzero exit with the corresponding model error. The original candidate stayed unchanged. The first negative-test attempt used the `/tmp` symlink, which Tauri refuses for executable resource resolution; rerunning under the canonical `/private/tmp` path reached and passed the intended checks. The initial restricted `say` invocation also produced an empty fixture; normal system access generated a valid PCM file before any successful speech test.

## Signed installer verification

Final artifact: `artifacts/signed-mac-2026-10-20-rc3/Manna_0.1.0-rc3_aarch64.dmg` (Apple Silicon), 570,487,005 bytes / 544.06 MiB. SHA256 after stapling: `fb3f15238b57b72ea82692fb20c686d09fe9f301c01865e15ce520a11c777c4a`.

Both Apple submissions were Accepted with no issues:

- Application: `b221161d-d74f-4b37-b5bc-633ade0a364f`.
- DMG: `bf2cdbbb-32b0-4d27-8463-962f793e7812`.

Both artifacts have timestamped Developer ID signatures for team `Y2GQPV7SRW` and stapled approval tickets. The app has hardened runtime and the microphone entitlement. Gatekeeper accepts both. The application distribution check returned no findings. The DMG disk integrity check passed before its final ticket was attached.

`scripts/verify-installed-mac.py` mounted the final DMG read-only and copied Manna into a fresh isolated installation directory. It verified both signatures and tickets, Gatekeeper, resource hashes before and after execution, all three translations, and actual offline speech. The installed copy reported Whisper as the default, loaded Small English from its own resources, transcribed the generated phrase, and detected John 3:16. Direct references, quotations, and three paraphrases passed for each of KJV, NIV, and NLT. No paid provider calls were made and no SQLite journals were written into application resources. Receipt: `artifacts/signed-mac-2026-10-20-rc3/installed-check.json`.

The first-launch guide was rendered and dismissed in automated React DOM tests. The native installed check uses package-verification mode and does not open the normal workspace or change a user profile.

Physical microphone permission/capture and another-machine validation remain operator/hardware checks. These automated checks do not establish Windows or Intel Mac compatibility.
