import { CheckIcon } from "lucide-react"
import type { SermonSummary } from "@/lib/summarize"
import { hasSermonContent } from "@/lib/summarize"
import { hasText, hasSermonFlow } from "../(lib)/summary"
import { SummaryCard } from "./summary-card"
import { SummaryOutline } from "./summary-outline"

export function SummaryNarrative({ summary }: { summary: SermonSummary }) {
  return (
    <div className="flex min-w-0 flex-col gap-9">
      {hasText(summary.title) && (
        <h1 className="text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
          {summary.title}
        </h1>
      )}
      {hasText(summary.big_idea) && (
        <SummaryCard
          title={
            hasSermonContent(summary) ? "The main message" : "Session summary"
          }
          tone="primary"
        >
          <p className="text-base leading-relaxed text-foreground">
            {summary.big_idea}
          </p>
        </SummaryCard>
      )}
      {summary.takeaways.length > 0 && (
        <SummaryCard title="Carry these with you" tone="accent">
          <ul className="flex flex-col gap-3">
            {summary.takeaways.map((takeaway, index) => (
              <li key={index} className="flex gap-3 text-sm leading-relaxed">
                <CheckIcon
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-primary"
                />
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </SummaryCard>
      )}
      {hasSermonFlow(summary) && <SummaryOutline flow={summary.sermon_flow} />}
      {summary.key_verses.length > 0 && (
        <SummaryCard title="Key scriptures">
          <ul className="flex flex-col gap-5">
            {summary.key_verses.map((verse, index) => (
              <li key={index} className="border-l-2 border-primary/25 pl-4">
                <h3 className="text-sm font-semibold text-primary">
                  {verse.reference}
                </h3>
                {hasText(verse.reason) && (
                  <p className="mt-1 text-sm leading-relaxed">
                    {verse.reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </SummaryCard>
      )}
    </div>
  )
}
