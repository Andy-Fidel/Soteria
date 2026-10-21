import type { SmsAlternative } from "../(lib)/sms-alternatives"
import { smsMetrics } from "../(lib)/sharing-drafts"

export function SmsAlternatives({
  options,
  selectedMessage,
  disabled,
  onSelect,
}: {
  options: SmsAlternative[]
  selectedMessage: string
  disabled: boolean
  onSelect: (message: string) => void
}) {
  if (!options.length) return null
  return (
    <section aria-label="SMS alternatives" className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Choose an approach</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Select a version, then edit the message below before sending.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {options.map((option) => {
          const selected = option.message === selectedMessage
          const metrics = smsMetrics(option.message)
          return (
            <button
              key={option.approach}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onSelect(option.message)}
              className={`flex min-w-0 flex-col gap-3 rounded-lg border p-4 text-left transition-colors disabled:opacity-60 ${selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50"}`}
            >
              <span className="text-xs font-semibold capitalize">
                {option.approach}
              </span>
              <span className="text-xs leading-relaxed [overflow-wrap:anywhere] break-words whitespace-pre-wrap">
                {option.message}
              </span>
              <span className="mt-auto text-[11px] text-muted-foreground">
                {metrics.units}/{metrics.limit} ·{" "}
                {selected ? "Selected" : "Use this version"}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
