# GitHub standard draft release verification

Verified 21 October 2026 on `codex/windows-offline-installer`.

## End-to-end run

[Workflow 39619275252](https://github.com/uxderrick/Manna/actions/runs/39619275252) passed from source commit `1624bba0c89405e9aff4aaa0ab37aad867dedc74`.

[The resulting RC3 draft](https://github.com/uxderrick/Manna/releases/tag/untagged-9b4bafb828e3c9b1352b) remains `draft=true`, `prerelease=true`, with no publication date. Its target commit matches both platform receipts. All seven uploaded asset digests were compared with `SHA256SUMS.txt`; both installer digests match their installed-test receipts. No `latest*.json` update feed was created.

| Candidate | Bytes | SHA256 |
| --- | ---: | --- |
| Windows x64, unsigned | 417,883,217 | `882d2d92e494daccdc52e36be64b9240b0d218bb1179b7549eeb7b999fc9d1de` |
| Apple Silicon, internal ad-hoc identity | 558,655,320 | `a0768a3f3c5448c14797a43746d33e6294e215cb2a4007471a2c19dba29cb6e8` |

Both platforms passed frontend tests (512), native tests (Mac 396; Windows 395, with 8 ignored on each), and installed offline speech plus direct/quotation/paraphrase detection across KJV/NIV/NLT. Mac uses Small English Q8; Windows uses Base English. Package resources remained unchanged. No paid provider calls were used. Native package checks took approximately 36.9 seconds on Mac and 46.4 seconds on Windows, including speech and detection setup; these are not physical microphone latency measurements.

Local verification also passed TypeScript, ESLint, actionlint 1.7.12, 13 release safety tests, 10 packaging tests, and 2 verifier tests (the third requires Windows and passed there). A staging dry run used the previously verified real Windows EXE. Local copies of the draft receipts and checksum file are in ignored `artifacts/draft-release-verification-2026-10-21/`.

## Remaining boundaries

- The draft is not approval to distribute publicly. Windows signing, the Mac CI Developer ID/notarization connection, Windows speech performance, NDI/Bible/media permissions, and real-laptop microphone/projector tests remain open.
- The previous signed/notarized Mac DMG and local signing credentials were not changed. This CI DMG has a separate `Manna Internal` identity.
- No app behavior, NDI integration, model choices, or existing update endpoint was changed by this task.
- The draft-only workflow is pushed on the working branch, not merged into the default branch. Select that branch when running it. Tags based on old commits can still contain the old publishing workflow.
- Reusing an existing release or tag is intentionally rejected. Prepare a new package version for a new candidate; existing releases and files are never overwritten by the helper.

For operator steps, see README → Preparing an internal release draft. Publishing remains a separate manual decision after reviewing the blockers and testing the final signed installers.
