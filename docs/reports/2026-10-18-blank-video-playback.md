# Blank video playback

Blank can now show the existing Light Refractions loop in both the On Screen panel and the projector output. The bundled copy is `public/backgrounds/light-refractions.mp4` (12 seconds, 1920×1080, H.264, 30 fps, silent). Its checksum matches the copy included in the production frontend build.

Settings → Branding → Blank background offers Looping video and Still image. Choose video imports MP4, M4V, MOV or WebM files into the app-data `com.manna.app/blank-videos` directory. A browser decode check must pass before the saved selection changes. Each import receives a unique filename, so it cannot overwrite a video that is playing. Unsupported or failed imports leave the selected background unchanged. MP4 with H.264 is recommended; a supported filename extension does not guarantee a supported codec. Existing custom still-image preferences remain active until the operator selects video.

## Rendering and lifecycle

Both outputs share the same silent looping decoder/canvas helper. Video does not drive React state on each frame. Returning to scripture, clearing the output, replacing the background, or unmounting stops the decoder, cancels frame callbacks and releases its source. A missing or failed video falls back to the configured still image. Imported videos persist with the existing branding settings and sync to both main and alternate outputs. The projector forwards video frames through the existing NDI path when active, respecting its frame rate and back-pressure guard.

The first native WebKit test exposed a compatibility issue: off-DOM video did not deliver `requestVideoFrameCallback` callbacks. A watchdog using animation frames now paints advancing video frames when those callbacks are absent or stalled. A regression test covers this condition. Normal decoded-frame callbacks remain preferred where they work. The fallback is capped at approximately 30 redraws per second and stops with playback. Projector canvas dimensions are changed only when its resolution changes, avoiding reallocating the canvas on each video frame.

The shared media helper is suitable for drawing video beneath future prayer text. This change does not add prayer-slide editing or video backgrounds to scripture themes.

## Playback and performance checks

The browser harness used the production On Screen canvas and production projector component. Native bridge messages were simulated for the harness. A separate check clicked the production Blank button and forwarded its emitted payload to the projector component; both started silent looping playback.

- Raw Chromium video baseline: 12-second 1080p source loaded; 95 reported frames and no dropped frames over about three seconds.
- Final simultaneous Chromium run: 26.002 seconds, two loop boundaries crossed in each view, 780 On Screen paints and 779 projector paints (about 30 per second). Both videos reported zero dropped frames.
- Canvas drawImage timing: median 0.2 ms and 95th percentile 0.3 ms in both views. On Screen canvas was 960×540 pixels; projector canvas was 1920×1080.
- Chromium page main-thread task time was 0.874 seconds over that 26-second run; script time was 0.401 seconds. These instrumented figures do not measure total CPU, GPU or hardware-decoder load.
- Native macOS WebKit run: both views played muted, crossed a loop boundary and continued past it. Across 14 seconds, the canvases painted 372 and 379 times (about 27 updates per second). WebKit reported zero total frames through its video-quality API, so that API was not used to claim a native dropped-frame count.

Switching back to scripture released all video sources and produced no further video paints. Decode failure displayed the same still-image fallback after image loading completed. The bundled MP4 passed the real browser decode check; an image supplied as a video was rejected. The temporary native runner and browser harness used generated state and did not change saved sessions or branding preferences. The native runner closed automatically; temporary browser harness files were removed.

## Automated verification

- 277 frontend tests passed across 46 files.
- 318 native workspace tests passed; five opt-in tests ignored by default.
- Production build, TypeScript, ESLint, Clippy performance checks and Git whitespace checks passed.
- Existing bundle-size and Clippy advisory warnings remain.
- Tests cover looping, cleanup, failed playback, unavailable/stalled decoded-frame callbacks, validation timeout, valid/invalid import containers, unique managed copies, saved preferences, legacy still-image preferences and both output payloads.

Physical projector hardware and an external NDI receiver were not available for verification. Large or high-resolution imported videos can use more resources than the tested bundled 1080p loop. Failed decode checks can leave an unused managed copy; this change does not add a video-library cleanup interface.

## Manual check

1. Press Blank and confirm both views show the moving background.
2. Present a scripture and confirm the video disappears immediately.
3. Open Settings → Branding → Blank background → Choose video and select a local H.264 MP4.
4. Press Blank again and confirm the chosen file plays silently.
5. Reopen the app and confirm the chosen video is retained.
