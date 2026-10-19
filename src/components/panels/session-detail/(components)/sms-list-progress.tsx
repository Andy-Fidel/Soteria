import type { ListSms } from "../(lib)/list-sms"

export function SmsListProgress({ send }: { send: ListSms }) {
  const processed = Math.min(
    send.recipientCount,
    send.totalSent + send.totalFailed
  )
  return (
    <section aria-label="SMS progress" className="space-y-3">
      <label className="block space-y-2 text-xs text-muted-foreground">
        Sending progress · {processed}/{send.recipientCount}
        <progress
          aria-label="Sending progress"
          max={send.recipientCount || 1}
          value={processed}
          className="h-2 w-full accent-primary"
        />
      </label>
      <dl className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 p-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Sent</dt>
          <dd className="mt-1 font-medium">{send.totalSent}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Delivered</dt>
          <dd className="mt-1 font-medium">{send.delivered ?? "Pending"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Failed</dt>
          <dd className="mt-1 font-medium">{send.totalFailed}</dd>
        </div>
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Delivery is confirmed only when the network receipt arrives. Progress
        updates for two minutes while this window is open. You can refresh it
        again at any time.
      </p>
    </section>
  )
}
