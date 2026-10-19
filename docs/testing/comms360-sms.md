# Saved-list SMS in Manna

Manna triggers a send and reads its progress. Contact management remains in Comms360.

## Setup

Restart Manna after the native commands have rebuilt. Settings → API Keys contains the Comms360 key, approved sender ID, and contact list ID. A blank key field keeps the saved key. The selected list is stored privately on this device; no account-specific list is embedded in the app source.

## Manual test

1. Open a session’s **SMS** tab. Generate three alternatives, select one, and review the editable message and sermon link. Choose **Send SMS**.
2. Confirm the saved contact list ID and sender. Choose **Preview cost**. This does not send messages.
3. Check recipient count, total SMS parts, and estimated cost in the unit returned by Comms360. Each recipient's message must fit one SMS part.
4. Choose **Send SMS** only when ready to send through the Comms360 wallet. If the list size or cost changed since preview, review the updated values and confirm again.
5. Monitor Sent, Delivered, and Failed. Progress checks run every eight seconds for up to two minutes while the modal is open. Use **Refresh progress** later, or close and reopen the modal to restore the saved send.

A completed send means processing finished. Delivery is confirmed separately from network receipts. Opening the modal, checking progress, and restarting Manna never submit a send.

## Retry protection

The exact message, list ID, sender, cost preview, and UUID retry reference are saved before submission. An uncertain submission reuses its original UUID and payload. Once Comms360 returns a send reference, the app cannot submit that session again. A stale preview or changed credential blocks submission. A definite rejection permits a new preview after the underlying issue is fixed.

Only one saved-list send record is kept per session. Replacing an unused preview makes the older preview reference invalid. The provider processes the send even if Manna closes; the app restores its reference to monitor it later.

Credentials and send records live under Manna's private app-data `sms` directory. On macOS/Linux, the directory is mode 0700 and files are mode 0600. Keys are never returned to the interface. Recipient phone lists are not copied into Manna or uploaded to the sermon website.

## Automated checks

```sh
bun run test:run
bun run typecheck
cargo test --offline --manifest-path src-tauri/Cargo.toml --lib commands::sms
```

The native regression tests use localhost mock servers and fictional credentials. The environment must permit localhost sockets. Tests marked ignored require explicit opt-in and saved credentials. They only preview costs or read an already submitted test; they never send SMS.

## API contracts

The live list preview returns `totalRecipients`, `totalParts`, `totalEstimatedCost` as decimal text, and `currency`. The parser also accepts the documented numeric cost/segment fields. Progress uses the send's returned reference. Delivery count comes from the filtered recipient response's `pagination.total`, without downloading the full contact list.

Sources: [SMS API](https://demo.comms360.africa/docs/sms), [campaign API](https://demo.comms360.africa/docs/campaigns), [Postman collection](https://demo.comms360.africa/postman_collection.json).

## SMS alternatives and layout

One AI request produces Encouragement, Reflection, and Action options. Selecting a card fills the editable message; generating another set preserves the selected draft. Each complete linked option must fit one SMS, including the invitation and three line breaks. The app requests one shorter rewrite if the response fails validation, then reports an error without replacing the existing draft or cards.

Linked SMS uses the takeaway, a blank line, `Read this week's sermon recap:`, then the permanent link on the next line. Existing drafts are normalized when opened, copied, or saved. Preview and accepted-send records retain the exact message reviewed for that send.
