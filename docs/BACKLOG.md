# Backlog

Last reviewed: 2026-10-19.

This is the current work list. Completed features, deliberately deferred ideas, and release checks are separate. Old estimates and model benchmarks have been removed; they are not current commitments. This review was not a new whole-project audit.

## In progress

- **Summary export and printing:** separate work is underway in the session-review UI and native print command. Verify its own completion and checks before treating it as shipped. It is outside the opacity/header cleanup change.

## Open, low priority

- **Remote-control UI:** bring the mobile remote into the current Manna visual style.
- **Additional translation search indexes:** consider ESV, NASB, NKJV, AMP and other supported translations after KJV/NIV/NLT. Measure detection accuracy, startup cost and memory before expanding.
- **Automated microphone/reconnect coverage:** implement the deferred end-to-end test for speaking, silence, disconnect/reconnect and resumed speech. Decide provider-credit use and offline Whisper coverage before enabling it in CI.
- **Release follow-ups:** evaluate signed installers, Linux builds, delta updates and Windows full-model packaging when preparing wider distribution. These are optional release improvements, not confirmed live-session bugs.

## Deliberately deferred

- **Configurable default items for new service plans:** skipped at the user's request. The plan header now keeps only Add slide; template and section-header buttons have been removed from that header.
- **Split-scripture first-part behavior:** optional return to the first part was discussed and deferred. Recheck the exact queue behavior and desired interaction before changing it; it is not a confirmed outstanding defect.

## Completed from recent feedback

- **Projection and operator workflow:** queue presentation selects the correct Bible book, chapter and verse; translation changes update the Bible, Queue and Detections panels; queue items display translation labels; On Screen supports continuous word highlighting, color confirmation and one-click clearing. Blank-slide clearing and the earlier live-presentation audit fixes are complete.
- **Listening and detection:** shared inference-lock fixes, detection warm-up, microphone recovery and multi-translation paraphrase search with NIV/NLT alongside KJV are implemented. Optional translation indexes must match the active embedding model; missing/incompatible indexes retain KJV search. See [translation index guidance](../embeddings/translation-indexes/README.md).
- **Songs and session review:** song display capitalization preserves original lyrics. Summaries distinguish worship from sermon content and retain the original transcript. Summary response-size/JSON failures were addressed. The improved summary reading layout is committed as `d28780c`.
- **Titles and slide library:** AI-confirmed announced sermon titles name eligible live sessions and fill empty service-title slides; manual names and slide edits stay protected. Editable titles/announcements, the approved pastor artwork, EWC mark, looping blank video, prayer slides, welcome/Jesus/closing artwork and redesigned welcome/MoMo slides are implemented. MoMo payment details are unchanged. The Add sheet is a single slide gallery; the plan uses a two-column visual card layout with live labels, editing, deletion and drag reordering.
- **Reference appearance and header cleanup:** references render at full opacity, including colors with embedded transparency, while preserving their color channels and verse-text opacity. The reference editor reflects full opacity. The service-plan header keeps only Add slide. These changes are included in the current cleanup backup.

## Verification and release checks

- **Latest cleanup verification (2026-10-19):** 382 frontend tests, lint, TypeScript checks and the production build passed. Browser checks covered all six built-in themes, legacy transparent reference colors, the reference editor and unchanged verse-text opacity controls. These checks did not restart the running presentation app and did not constitute a physical-projector test.
- **Historical smoke checklists:** older Songs and Overlay Themes plans still contain pending/manual checklist entries. Reconcile those entries against current operator testing before the next release; an unmarked historical checkbox alone is not evidence of a current bug.
- **Native validation:** recording/session lifecycle and JSON plan persistence were tested during the earlier audit and slide work. Rerun native checks for subsequent native changes, including the separate print work; the opacity/header changes are frontend-only.

## Earlier shipped foundations

- Songs library, shared song/scripture queue and Planner are implemented.
- Service-plan persistence, timing, keyboard navigation and existing template data support are implemented. Removing header buttons does not delete saved plans or templates.
- Theme Designer, custom-theme persistence, projection overlays, verse history and analytics are implemented.
- The six-item historical reliability sweep and the later seven-issue audit fixes were completed; `56b976f` backed up the latter.
- Release automation, setup commands and Qwen3 INT8 feature-extraction support are implemented. Shipping signed installers or additional packaging variants remains separate from the existing release pipeline.

## Research only

- Cloud processing with a lightweight desktop client for lower-end hardware.
- A larger Qwen embedding model, only if measured retrieval problems justify its memory/startup costs.
- Twi/Ga/Ewe Bible sourcing and licensing, followed by a suitable multilingual retrieval evaluation.
- The earlier EmbeddingGemma replacement proposal was rejected; it is not an active task.
