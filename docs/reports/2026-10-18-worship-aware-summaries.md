# Worship-aware session summaries — 18 October 2026

## Behavior

Summary requests distinguish spoken teaching from performed worship, worship-leading, prayer, and announcements. Religious words and repetition alone do not decide the classification. A preacher discussing a lyric as an illustration remains teaching; actual lyrics are not attributed as original pastor quotes.

The same rules run in the existing short-transcript request, long-transcript section notes, intermediate note merges, and final recap. Intermediate notes retain worship context separately from spoken teaching. Final sermon opening and conclusion come from the first and last teaching portions, rather than opening or closing songs. Displayed scripture references alone do not establish that preaching occurred. This adds no extra AI request or classification pass.

New summaries record `session_content` as `sermon`, `mixed`, `worship`, or `other`. For worship-only and other sessions without teaching, the frontend clears sermon points, key verses, devotional content, takeaways, and attributed quotes. It shows “Worship session” or “Service session” and states that no sermon teaching was identified. Display and Markdown export avoid empty sermon sections. Older summaries without this field remain compatible and are not automatically rewritten; regenerate them to apply the new behavior.

## Original transcript

No transcript storage path or editing command was changed. The summary still reads the captured segments and writes only summary JSON. A regression checks this orchestration against frozen Unicode transcript segments, verifies the exact input supplied to the summarizer, and rejects unexpected write commands. Existing native section tests verify that complete UTF-8 input reaches summary requests without dropping the ending.

## Verification

- Frontend: 225 tests passed, including non-sermon suppression, mixed-service retention, classification round-trip, older saved summaries, worship display/export, and transcript preservation.
- Native workspace: 299 tests passed; four opt-in tests were ignored in the general run. The new live summary test was then run explicitly.
- TypeScript/production build, ESLint, Rust performance checks, and Git whitespace checks passed. Existing Rust advisory warnings and the bundle-size warning remain.
- An independent code review found no blocking defect. Its long-recording coverage finding was addressed by enlarging the live fixture above 48,000 bytes so the real intermediate merge path executes.

With the user's explicit approval, the configured DeepSeek account was used only for generated fixtures. No saved transcript was submitted, and no credential was displayed or logged. All six cases passed on the final live run:

| Generated case | Expected classification | Result |
|---|---|---|
| Worship only, with a presented scripture | worship | Passed; no invented sermon points, key verses, devotional, takeaways, or pastor quotes |
| Worship before and after teaching | mixed | Passed; forgiveness teaching retained and lyrics excluded from points and quotes |
| Repeated phrases within teaching | sermon | Passed; teaching retained |
| Lyric discussed as a sermon illustration | sermon | Passed; teaching retained and lyric not attributed as a pastor quote |
| Announcements and a closing prayer | other | Passed; no invented sermon |
| Long worship/teaching/worship recording, 50,845 UTF-8 bytes | mixed | Passed through five source sections, an intermediate notes merge, and the final recap |

The six-case live run took 33.22 seconds in total. This is a small developer-written evaluation, not a production accuracy estimate. Text-only classification can still be uncertain when sung and spoken words have little context; original captured text remains available for review.

## Follow-up: truncated section JSON

The user encountered `Bad section JSON from DeepSeek: EOF while parsing a string at line 1 column 3363`. The section request allowed only 768 output tokens and the API client discarded the provider's `finish_reason`, accepting the inner content without checking its JSON. The original failure did not retain completion metadata, so its exact stop reason cannot be proven retrospectively. The acceptance of truncated output was reproduced with a local HTTP server before fixing it. DeepSeek's [JSON guidance](https://api-docs.deepseek.com/guides/json_mode/) warns that an insufficient output-token limit can cut a JSON string off midway.

Section output now allows 2048 tokens and final recaps 4096. The client validates both completion status and JSON before accepting content. It regenerates an incomplete or invalid response once from exactly the same full source, doubling the budget with an 8192-token cap. This retries only the failing request, retaining already-completed transcript sections. Repeated failure returns a clear error instead of partial JSON. The existing 6000-byte notes bound and source-section coverage remain in place. Transient provider errors retain the existing model fallback.

Three local HTTP regressions passed after failing against the old implementation: token-limited but syntactically valid JSON, malformed JSON despite a reported normal stop, and repeated cutoffs with a bounded error. The frontend also verifies that a failed regeneration does not overwrite the saved summary. Full verification now passes 302 native tests and 226 frontend tests, plus TypeScript/production build, ESLint, and whitespace checks.

The six approved live generated-fixture cases also passed again after the response-handling fix, including the 50,845-byte multi-level merge case. That repeat run took 29.87 seconds. Rust performance checks passed with the existing advisory warnings. The independent follow-up review found no blocking defect.

## Follow-up: oversized complete section notes

The next user attempt produced complete JSON above the 6000-byte note bound. The truncation fix had left this as a hard failure rather than recovering. The two bounds now have separate handling: response completion remains validated by the API client, while section and merge notes are normalized and shortened as needed.

Notes are parsed and serialized as compact JSON before measuring size, preserving all field values while removing formatting/escape overhead. Normal requests now target 2500 bytes with concise teaching notes, brief worship context without copied lyrics, and no more than two short exact quotes. Valid notes above 6000 bytes trigger one additional request with stricter brevity guidance and the exact original full section or merge input. No strings, JSON, source segments, or merged input sections are sliced or silently skipped. Accepted notes remain within the existing bound. A repeatedly oversized response fails safely after the bounded retry, before final recap persistence.

Four regressions failed before this fix and pass afterward: formatting-only overhead, source-section size recovery with original input retained, merge size recovery retaining all five section markers, and bounded repeated oversize failure. The existing byte-preservation, tail-coverage, invalid-response, failed-save, and worship classification checks remain in place.

The six approved live generated-fixture cases passed again in 27.98 seconds. The long mixed fixture now deliberately injects an oversized response in its teaching section and another in an intermediate merge. The real DeepSeek provider must regenerate compact notes from the original inputs at both boundaries and produce the final recap; assertions verify the actual forgiveness teaching remains and performed lyrics do not become sermon points or pastor quotes. No saved transcript is sent by this test.

Full checks passed: 306 native tests, 228 frontend tests, TypeScript/production build, ESLint, and Git whitespace checks. The independent review found no blocking issue. Four opt-in tests remain excluded from the general native run; the live summary test was run explicitly. The original transcript and existing saved summary are untouched when generation fails.
