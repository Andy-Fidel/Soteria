# Live announced sermon titles

New live sessions can replace the untouched date-based name with an explicitly announced sermon title. Editing the name at creation or renaming it later saves manual ownership. Existing session names migrate to manual ownership because their origin is unknown. Automatic naming applies only once, while the session remains live. The original transcript remains unchanged.

## Implementation

- A local phrase check examines the latest three final transcript segments, capped at 2,000 characters. Partial speech results do not trigger naming. A 600 ms wait allows adjoining final segments to arrive.
- Likely announcements trigger a background DeepSeek check using a bounded excerpt from the saved final transcript. No database or application lock is held during that request. Only a clear title and supporting text copied from the excerpt can be accepted.
- Each request has an eight-second timeout. There is one request at a time and at most three attempts per session. Missing credentials, rejected candidates, invalid responses and network errors leave the existing name in place.
- Database checks reject results after a manual rename, after the session ends, after automatic naming has already succeeded, or when additional transcript text invalidates the source snapshot. Split announcements can be checked again with their adjoining words.
- Live and saved session views update after naming. Both session-creation forms track whether the operator edited the default name. The forms were extracted into local components to keep this state with the controls that own it.

## Verification

- Full frontend suite: 252 passed.
- Full native workspace suite: 316 passed, five opt-in tests ignored by default. The generated live title test was run separately with explicit user permission.
- TypeScript and production build passed. ESLint and Git whitespace checks passed.
- Clippy performance check passed. Existing advisory warnings and the existing frontend bundle-size warning remain.
- Native tests cover exact-source evidence, unsupported titles, invalid or truncated JSON, unavailable and timed-out providers, manual ownership, legacy migration, restart persistence, completed sessions and in-flight split-title results.
- Frontend tests cover announcement variants, ordinary speech, adjoining segments, serialized requests, failed requests, absent credentials, manual edits, session changes, ended sessions and continued transcript capture during a pending title request.

## Generated live evaluation

Sixteen generated excerpts were sent to DeepSeek. No saved session transcript was sent. All sixteen matched expectations: six clear announcements (including an immediate correction) were accepted, and ten misleading examples were rejected. Negative examples included worship lyrics, song titles, series names, sermon points, previous/future sermons, quoted announcements, negated titles, ordinary teaching and source-text instructions.

AI response time was 918–1,446 ms; median 1,137 ms. These timings exclude the 600 ms settling wait, speech recognition and database/IPC overhead. A local trigger benchmark over seven batches of 100,000 checks measured a median batch average of 0.000241 ms per check. This is a local microbenchmark, not a complete speech-to-name latency measurement.

## Limits and manual check

This uses common English announcement phrases and requires the configured DeepSeek key and network access. The generated evaluation does not establish accuracy on every pastor, language or speech-recognition error. A later title announcement does not replace a title already accepted; manual renaming remains available. Real microphone interaction with the new naming feature was not tested in this run.

1. Start a new session and leave its date-based name unchanged.
2. Start transcription and say: “My message today is titled Faith in the Waiting.”
3. Check that the live session name changes after the final transcript appears.
4. Create another session with a name you type yourself, then repeat the announcement and confirm that the name stays unchanged.
5. Confirm the captured transcript still contains the original words.
