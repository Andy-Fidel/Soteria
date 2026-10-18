# Initial detection delay and earlier preparation — 18 October 2026

## What the logs establish

This was not a late model load. After the requested restart, the MiniLM model had been probed at 00:53:36 and KJV/NIV/NLT were ready by 00:53:48. The service started at 00:54:44; AssemblyAI connected at 00:54:50. The first completed utterance at 00:54:58 was too short for semantic search. The first full test phrase reached semantic processing at 00:55:37, embedded in 31.8 ms, and produced results at 00:55:38.

Therefore the observed initial connection stage took approximately six seconds. The old logs cannot divide that stage reliably into microphone/provider setup, DNS, TCP, TLS, and authenticated WebSocket upgrade. Nor do they establish exactly when the user began each sentence. The model calculation itself accounts for only a small part of the delay. The earlier chat explanation that this was likely model warm-up was incomplete.

The existing generic HTTP warm-up contacted `api.assemblyai.com`, whereas streaming uses `streaming.assemblyai.com`; it did not retain a transport for the speech WebSocket. Separately, vector search was running without optimization under `bun run tauri dev`.

## Changes

- Selected-provider preparation runs after settings hydrate and is refreshed during the pre-service check. It prepares DNS/TCP/TLS to the actual streaming host. It sends no API key, microphone data, or authenticated WebSocket request.
- The actual speech connection consumes that prepared TLS transport when Start is pressed. The socket expires after 20 seconds; a new preparation replaces stale resources. Failed/expired server connections fall back to the existing fresh connection path.
- Preparation has an eight-second total deadline, including lock wait when app startup and preflight call it concurrently. Offline preparation becomes a warning, with normal Start allowed to retry. Local Whisper skips cloud preparation.
- Preflight waits for preparation and the sound check in parallel. Canceled checks cannot overwrite a newly opened dialog. Check state starts fresh on each open; audio-probe behavior is retained in a small local helper.
- Startup warms the full model/vector/ensemble path without publishing synthetic detections, changing sermon context, or consuming live auto-queue cooldown.
- The detection and SHA-256 hashing crates use optimization in the development profile. Other app code remains in development mode. No detection thresholds or translation data changed in this task.
- Diagnostics now record WebSocket connection time, whether its transport was prepared, semantic lock wait, and search duration. API-key previews were removed from startup logs.

## Measurements

Same release from the previous feature, same 50 developer-written phrases, same MiniLM model, three passes per configuration; this comparison specifically uses the **development** build before/after the profile change. No authenticated live transcription was used in the benchmark.

| Metric | Before | After |
|---|---:|---:|
| Median development search | 685.7 ms | 33.8 ms |
| 95th-percentile development search | 2758.5 ms | 160.0 ms |
| Model/index initialization and probe in benchmark | 12124.4 ms | 1418.2 ms |
| Correct paraphrase first result | 22/25 | 22/25 |
| Correct paraphrase among first three | 25/25 | 25/25 |
| Quotation first result | 5/5 | 5/5 |
| Negative phrases producing results | 0/20 | 0/20 |

The running app then logged full semantic warm-up at 136–147 ms before service start, and selected AssemblyAI TLS preparation at 665–678 ms. A separate live transport test prepared AssemblyAI TLS in 850 ms on its final run (1134 ms on the earlier run), reused the cache in 0 ms, and confirmed the socket accepted an unauthenticated HTTP HEAD. These are observed runs, not guaranteed network timings. They do **not** measure the remaining authenticated speech-session handshake or the delay until a completed transcript arrives.

## Verification

- Browser checks: preparing state keeps Start disabled; prepared state allows Start; cancellation/reopen ignores old results; offline preparation warns and permits normal retry; Whisper makes no preparation call.
- Native regressions: consume-once cache, TTL expiry, unsupported/local providers, prepared WebSocket reuse, closed/unresponsive socket recovery, total deadline including in-flight lock wait, and warm-up preserving first real detection cooldown.
- Final native suite: 294 passed, zero failures; two local/network-dependent tests ignored in the general suite. The real unauthenticated AssemblyAI transport probe was explicitly run and passed.
- Frontend: 219 tests passed; TypeScript/production build and ESLint passed.
- The current app restarted automatically through `bun run tauri dev` and logged semantic readiness and selected-provider preparation.

## Retest

Open the pre-service check, wait for Speech Connection to finish, then start. Speak after the service shows it is listening. Compare the first phrase with later phrases. If there is still a delay, the new connection/search timing fields distinguish waiting on the server from local search. A complete authenticated microphone-to-detection timing test still requires this user retest; no claim is made that all six seconds have been eliminated.

Raw development benchmark results are stored beside this report. Changes are uncommitted.

## Follow-up: speech connected but no transcript

The user's next microphone attempts exposed a readiness gap. At 01:24:01 and 01:24:57, the app logged HTTP 101 and `Connected` using prepared transports, but neither attempt logged AssemblyAI's `Begin` frame or any transcript. Audio capture started on the MacBook Pro microphone without a logged capture error. HTTP upgrade was being treated as proof of a usable speech session, so this state could wait indefinitely without retrying.

The exact reason those two server sessions failed to begin is not established. Separate authenticated probes received Begin over fresh and prepared transports, including a five-second idle prepared transport. Generated speech also transcribed through the existing full runtime on both single-thread and multi-thread executors. These results do not support claiming that all prepared transports fail or that microphone permissions caused the problem.

AssemblyAI now must send Begin within five seconds before the app publishes Connected and sends audio. A prepared connection that upgrades but fails this check is dropped and retried fresh. A fresh session that fails readiness enters the existing bounded reconnect path. Deepgram's readiness behavior is unchanged. Diagnostics record the first successfully sent audio batch without recording its content.

The new local regression reproduced the silent state before the fix and passed afterward: a server accepts HTTP upgrade but withholds Begin, then a fresh session delivers Begin and a transcript. Additional regressions cover fresh-session timeout and explicit session rejection. A final authenticated generated-speech test passed through both full runtime paths: observed readiness took 1850 ms fresh and 846 ms prepared in that run. No user microphone audio or credentials were included in test output. This validates generated audio delivery and recovery, while the user's own microphone-to-app retest remains necessary.

A subsequent app attempt at 01:35:22 also produced a distinct, explicit microphone failure: `Failed to build input stream: The requested device is no longer available`. The app had selected the default MacBook Pro microphone. The old capture-thread error only cleared one active flag and returned; the Start command could already have reported success. Startup now waits up to 15 seconds for the first actual microphone frame. Capture errors or a missing first frame fail the Start command, clear both active flags, and reach the existing user-facing error path. No speech-provider session is opened before this succeeds. Two regressions verify that startup waits for confirmation and that capture failure is returned with both flags cleared.

The development app was restarted outside the execution sandbox to restore normal microphone access. This is an environment precaution, not proof that sandboxing caused the device failure. The OS-reported device failure and the earlier absent Begin frames are separate observations. The physical microphone still needs a user retest in the running app. Frontend verification remains 219 passing tests; the final native verification is 299 passing tests with three opt-in tests ignored in the general run. The real generated-speech test was separately run and passed.

## Confirmed system audio failure

The user confirmed the explicit microphone error continued after the normal-access app restart. A standalone temporary probe using the same audio crate reproduced the failure outside Manna. Both enumerated devices were visible: the iPhone microphone and the default MacBook Pro microphone, each at 48 kHz mono. The default microphone failed to open in the probe as well.

A temporary copy of CPAL, used only by the probe, exposed the native error masked by CPAL's generic DeviceNotAvailable conversion: CoreAudio `Unknown(1937010544)`. The macOS coreaudiod error log independently recorded the same code, IO thread startup failures, hardware DSP configuration failures, and the device being in an inconsistent state. These observations identify a system audio-engine failure; they do not prove that Manna's network warm-up or microphone permissions caused it. No user audio was stored or transmitted by the microphone probe. No production audio library or system setting was changed during these checks.

Restarting the system audio service is a proposed recovery step. It can interrupt audio in other apps, so user confirmation is requested before doing so. Microphone frame delivery and in-app transcription must be checked afterward.

After the user restarted coreaudiod with administrator approval, the same standalone probe succeeded: `microphone_open=true`, `audio_frame_received=true`, and a 171-sample frame from the default MacBook Pro microphone. This confirms microphone capture recovered after restarting the macOS audio service. In-app live transcription remains the final user check.
