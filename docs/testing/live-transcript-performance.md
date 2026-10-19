# Live transcript update performance

Measured 2026-10-19. The baseline transcript panel matches source blob `9913fb3` in commit `f659f4c`. Baseline and updated production browser bundles were built from the same isolated source snapshot, replacing only the transcript panel and its new display component for the updated bundle.

## Change

`TranscriptPanel` now owns native event handlers and recording controls without subscribing to partial text or the completed-line array. `TranscriptContent` owns those display subscriptions and the existing scrolling effect. Its memoized `CompletedLines` component skips processing when the completed array is unchanged. The live sentence updates separately. Final sentences still produce a new array and update the completed list and its recent-line opacity rules.

Every completed line remains in the interface and in the transcript store. This is not a visible-row-only list. No native transcription, detection, storage, padding, or provider settings changed. A new dev-only declaration pins the already-installed `jsdom` 26.1.0 package so clean installs can run the DOM tests without relying on Fabric's optional dependency.

## Method

- Actual `TranscriptPanel`, application stores, event hook, transcription handlers, production React, and application stylesheet.
- Chromium 155.0.8059.84 on Mac, reporting 12 logical processors. This is a browser component test, not the macOS Tauri WebKit view or actual Windows WebView2 hardware.
- Generated histories of 500, 2,000, and 5,000 distinct completed paragraphs. Counts are stress fixtures, not an estimate of service duration.
- 120 timed partial updates for each history, repeated twice at normal CPU speed and twice with Chromium's 4× CPU slowdown. Each repetition/rate uses a fresh page with one isolated CDP session. Throttling is not equivalent to any specific low-end Windows laptop.
- A local mock replaces only the native bridge. No microphone, saved transcript, real session, or paid provider is used. The isolated browser origin does not read Manna's native settings or keys.
- Timers include synchronous React updates and the layout read needed to check scrolling. They exclude the gaps between updates and do not measure speech-to-screen latency, whole-app processor use, frame rate, or session persistence on disk.
- Fonts are loaded before timing. One partial update warms the path. Every 20 updates the harness yields a frame. Memory is sampled after garbage collection using CDP `Runtime.getHeapUsage`; DOM counts come from `Memory.getDOMCounters`.

Initial exploratory runs were discarded because an attached CPU-throttle session persisted across calls. The reported runs use fresh pages and detach their protocol sessions before closing the pages. The before/after stylesheet hashes match. All other source files in the benchmark snapshot remain identical, isolating this change from concurrent theme and SMS work.

## Update time

Medians per partial update, two repetitions:

| Completed lines | CPU setting | Before | After |
| --- | --- | --- | --- |
| 500 | Normal | 0.3 / 0.3 ms | 0.2 / 0.2 ms |
| 2,000 | Normal | 1.0 / 1.0 ms | 0.9 / 0.6 ms |
| 5,000 | Normal | 2.4 / 2.3 ms | 1.7 / 1.4 ms |
| 500 | 4× slowdown | 1.2 / 1.3 ms | 1.2 / 0.8 ms |
| 2,000 | 4× slowdown | 4.2 / 4.5 ms | 2.8 / 2.8 ms |
| 5,000 | 4× slowdown | 11.5 / 12.1 ms | 8.6 / 8.6 ms |

For 5,000 lines under slowdown, the 95th-percentile update fell from 13.8–14.2 ms to 9.7–10.1 ms. The gain is modest in short histories and becomes more useful as the list grows. This does not demonstrate a full-app speed increase of the same percentage. Times use the browser's approximately 0.1 ms timer resolution.

## Memory

Retained JavaScript heap after garbage collection:

| Completed lines | Before | After |
| --- | --- | --- |
| 500 | 2.64–2.66 MiB | 2.40 MiB |
| 2,000 | 3.62–3.71 MiB | 2.87 MiB |
| 5,000 | 5.72–5.75 MiB | 3.80–3.81 MiB |

These are JavaScript objects in the isolated browser page, not process peak RAM or total Manna memory. Browser DOM/native heap remained approximately the same (about 16.4–16.6 MiB at 5,000 lines). DOM counts are identical before and after: 1,031, 4,031, and 10,031 nodes respectively. Keeping the entire transcript in the interface still has a memory and layout cost; this change does not remove it.

## Behaviour checks

All 12 before/after comparisons retained the full completed-line count and had byte-identical transcript-panel HTML fingerprints after the updates. Real browser checks passed before and after for replacing partial text, keeping completed history intact, adding a final sentence once, clearing the partial, scrolling to the bottom, reconnecting and resuming updates, pause/resume buttons, and clearing to the idle state.

The existing auto-scroll policy is preserved: a new partial or final update returns to the bottom even after the operator scrolls up. The benchmark checks actual element geometry. DOM unit tests use an explicit scroll-height fixture because jsdom does not perform layout.

Six new component tests use the real panel, stores, and event handlers with the native boundary mocked. The performance regression test watches access to a completed segment's text: it fails on the baseline because partial updates read that text again, then passes after the split. The other tests cover partial replacement and final append, scrolling (including finals without a preceding partial), full long-history retention and clearing, reconnect/resume, and pause/resume controls. Existing transcription-store tests cover session-save payloads separately.

The full frontend suite passed 460 tests. Lint and the typed production build passed. The existing large-bundle warning remains. No physical microphone recovery, actual speech-recognition accuracy, or paid provider test was performed for this UI-only change.

## Reproduce

1. Run `bun run test:run src/components/panels/transcript-panel.test.tsx src/stores/transcript-store.test.ts` for automated component/event checks.
2. Build an isolated page that mounts the real panel with a mocked native bridge and generated transcript-store data. Keep the actual application CSS and wait for fonts to load.
3. Use `flushSync` to deliver distinct partial events; time each update through the scroll-height read. Compare matching fixtures in production builds, with fresh pages for each CPU setting.
4. Collect garbage before retained-memory samples. Compare JavaScript heap, browser/native heap, and DOM counts separately; do not present JavaScript heap as total app RAM.
5. Repeat on representative Windows hardware before setting a device requirement or promising the same speed gain.

The complete temporary harness root is recorded in `/tmp/manna-transcript-benchmark-state.json`; it contains `before` and `after` snapshots, bridge mocks, browser entry, Vite configurations, and production bundles. The paired raw samples and comparisons are in `/tmp/manna-transcript-performance-results.json`. Temporary artifacts can be removed by the OS; the results and method are retained here.
