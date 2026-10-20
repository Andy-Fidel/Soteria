# Reviewed sermon audio

**Paused:** the audio editor and website player are hidden by default. Prepared files and the implementation are retained. The steps below apply when the feature is re-enabled. No production deployment is part of this work.

Public Recap → Review sermon audio opens the editor. Opening a recap does not fetch or play the recording. End a live session before editing. FFmpeg and FFprobe must be installed on this computer; errors explain when either tool is missing.

## Operator check

1. Open a completed session with a recording and transcript. In Public Recap, choose Review sermon audio, then Auto-trim.
2. Listen around both points. Adjust Start time and End time, or use Set start here / Set end here while listening. Suggestions include a four-second start buffer and a three-second end buffer. Review the transition from worship/announcements into teaching and the sermon-related response at the end.
3. Confirm that you reviewed the points, then choose Prepare MP3. Listen to the resulting MP3. It should contain the intended sermon, balanced volume and short edge fades. The original recording remains available unchanged in Transcript.
4. Select Include audio in recap, then publish. The app uploads the prepared copy in bounded chunks and shows progress. Nothing uploads merely from suggesting, preparing, opening a tab, or restarting Manna.
5. Open the published recap on a phone and desktop. Check playback and seeking near the start, middle and end. Republish text without a new recording and confirm the existing published audio remains attached.

## Boundaries and storage

- AI sees the timestamped transcript's segment IDs and text, not the raw audio. It returns first/last sermon segment IDs. The app validates those IDs, their order and confidence, and uses the persisted recording timeline to map them to audio offsets. Unclear or oversized transcripts leave manual editing available.
- Preparation is a contiguous cut, not removal of words or pauses within the sermon. There is no aggressive noise suppression. Noise/worship outside the chosen range is excluded. Volume is normalized and edge fades reduce clicks.
- Cuts must span at least three seconds. Source duration is limited to four hours; prepared upload size is limited to 96 MiB. Export uses mono MP3, 24 kHz, 48 kbit/s. An hour is roughly 22 MB; exact size depends on duration and MP3 overhead.
- Each preparation writes a new `sermon-<revision>.mp3` beside the original and atomically updates `sermon-edit.json`. Source size/modified-time checks invalidate an export if the recording changes. Publish also checks that the selected revision is still the reviewed revision. Deleting a recording removes its prepared local copies too.
- Uploads use the existing private publishing credential and 3,000,000-byte chunks. Retrying uses the same prepared revision and chunk keys. Partial uploads are not served publicly. The publication is updated only after every chunk is present and sized correctly.
- The website streams the published MP3 with byte-range responses for seeking. Chunk objects remain private. Public audio is available only for the exact audio reference attached to a published recap. Existing published audio is preserved on text-only updates. This first version retains old cloud revisions like the existing artwork versions; it does not implement storage cleanup.

## Automated checks

- App tests cover manual time parsing, review and preparation gates, selection invalidation, suggestion failures, and lazy audio loading.
- Native tests cover cut validation, transcript IDs, pause-aware mapping, stale exports and deletion. The explicit FFmpeg integration test generates an eight-second sine tone, cuts it, checks duration, and verifies that the original bytes are unchanged.
- Website tests cover audio ownership/size metadata, valid and invalid ranges, exact seeking across chunk boundaries and unpublished-file protection.
- No saved transcript or real recording is used by these automated tests. AI boundary accuracy and the sound of a real sermon still require operator review.

Run the synthetic export check explicitly:

```sh
cargo test --offline --manifest-path src-tauri/Cargo.toml --lib commands::sermon_audio -- --ignored
```
