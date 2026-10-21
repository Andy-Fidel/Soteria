# Microphone recovery checks

Run from the project root:

```sh
bun run test:microphone-recovery
```

The suite requires installed Rust dependencies. Cargo uses `--offline`; the tests use only local memory, temporary files, and WebSocket servers bound to `127.0.0.1`. No API keys, saved recordings, or paid provider calls are used. Live provider tests remain ignored. A restricted test runner must permit loopback sockets.

## What is covered

- Audio conversion: stereo 48 kHz input becomes mono 16 kHz audio. Speech has a measurable level; silence remains zero. A closed consumer does not block capture.
- Device errors: the capture callback reports a device-unavailable error through a bounded, nonblocking channel. The live capture owner clears listening flags, reports how to restart, and reaches the existing recording-finalization path.
- Transport recovery: synthetic PCM passes through the production WebSocket runtime and the actual Deepgram and AssemblyAI response parsers. The local server closes normally or drops its connection abruptly. The runtime reconnects and the real direct-reference detector finds John 3:16 before the drop and Romans 8:28 afterward.
- Audio-source restart: closing the audio source ends its run without reconnecting a dead source. A fresh run transcribes the scripted response and detects scripture. Stop also completes when the server does not acknowledge closure.
- Frontend state: reconnects preserve listening state; device loss clears stale partial text and the frozen meter. Resumed transcript segments are saved to the same live session without erasing earlier speech. Runtime error instructions reach the notification handler. Title detection is mocked in these tests.

## Existing checks retained

The command also runs audio voice/silence gating, MP3 encoding, prepared-connection expiry/fallback/readiness, microphone startup confirmation, and transcription lifecycle tests. Tests that require provider requests are not enabled.

## Limits

The speech-server replies are scripted. This tests audio transport, real response parsing, detection, and state recovery. It does not measure recognition accuracy or replace an operating-system USB/Bluetooth unplug test. It does not run the semantic embedding model.

Network disconnections reconnect automatically. A failed physical microphone stops listening; reconnect or select the input, then press Start. Automatic switching between physical microphones is not introduced by this change.

## Optional hardware check without paid calls

Use local Whisper only if its model is already installed. Do not download a model or enable a cloud provider for this check.

1. Start a temporary session using local Whisper and an external microphone.
2. Say “John chapter three verse sixteen” and check the transcript and detection.
3. Unplug the microphone and check that listening stops, the meter clears, and an error appears.
4. Reconnect the microphone, select it in Audio settings if needed, and press Start.
5. Say “Romans chapter eight verse twenty eight” and check that detection resumes and the earlier transcript remains.

End the temporary session after the check. Physical hot-plug behavior remains a manual release check.

## Verification on 2026-10-19

The command passed 11 frontend checks and 31 native checks (10 audio, 10 STT, 8 lifecycle/startup and 3 integration tests). Two live-provider/network probes stayed ignored.

A saved-baseline snapshot with only the microphone changes passed all 407 frontend tests, lint, TypeScript checks and the production build. Native performance lint checks also passed, with existing warnings. A full mixed-workspace run encountered seven failures in concurrent theme work; those files were not changed as part of microphone recovery. The physical hardware checklist was not performed.
