import type { SermonSummary } from "@/lib/summarize"
import { hasText, hasDevotional, quoteSpeaker } from "../(lib)/summary"
import { SummaryCard, SummaryField } from "./summary-card"
export function SummaryFollowUp({
  summary,
  speaker,
}: {
  summary: SermonSummary
  speaker?: string | null
}) {
  return (
    <aside className="flex flex-col gap-3 lg:sticky lg:top-2 lg:self-start">
      {hasDevotional(summary) && (
        <SummaryCard title="Devotional Follow-up">
          <div className="flex flex-col gap-2.5">
            {hasText(summary.devotional.scripture) && (
              <SummaryField
                label="Scripture"
                value={summary.devotional.scripture}
              />
            )}
            {hasText(summary.devotional.observation) && (
              <SummaryField
                label="Observation"
                value={summary.devotional.observation}
              />
            )}
            {hasText(summary.devotional.application) && (
              <SummaryField
                label="Application"
                value={summary.devotional.application}
              />
            )}
            {hasText(summary.devotional.prayer) && (
              <SummaryField label="Prayer" value={summary.devotional.prayer} />
            )}
            {summary.devotional.reflection_questions.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Reflection Questions
                </p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {summary.devotional.reflection_questions.map(
                    (question, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-xs leading-relaxed text-foreground/85"
                      >
                        <span className="shrink-0 text-muted-foreground/60">
                          {i + 1}.
                        </span>
                        <span>{question}</span>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}
          </div>
        </SummaryCard>
      )}

      {summary.quotes && summary.quotes.length > 0 ? (
        <SummaryCard title="Quotes" tone="primary">
          <ul className="flex flex-col gap-2">
            {summary.quotes.map((q, i) => (
              <li
                key={i}
                className="group flex flex-col gap-1.5 rounded-md border border-border bg-card/60 p-3"
              >
                <p className="font-serif text-sm leading-snug text-foreground italic">
                  “{q.text}”
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {quoteSpeaker(q.speaker, speaker)}
                  </span>
                  <button
                    onClick={() => {
                      const line = `“${q.text}” — ${quoteSpeaker(q.speaker, speaker)}`
                      navigator.clipboard.writeText(line)
                    }}
                    className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                  >
                    Copy
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </SummaryCard>
      ) : (
        <SummaryCard title="Quotes">
          <p className="text-[11px] text-muted-foreground">
            No notable quotes pulled from this sermon.
          </p>
        </SummaryCard>
      )}
    </aside>
  )
}
