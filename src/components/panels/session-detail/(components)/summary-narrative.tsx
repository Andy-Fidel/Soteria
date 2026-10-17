import type { SermonSummary } from "@/lib/summarize"
import { hasText, hasSermonFlow } from "../(lib)/summary"
import { SummaryCard, SummaryField } from "./summary-card"
export function SummaryNarrative({ summary }: { summary: SermonSummary }) {
  return (
    <div className="flex flex-col gap-3">
      {(hasText(summary.title) || hasText(summary.big_idea)) && (
        <SummaryCard title="Big Idea" tone="primary">
          {hasText(summary.title) && (
            <p className="text-sm font-semibold text-foreground">
              {summary.title}
            </p>
          )}
          {hasText(summary.big_idea) && (
            <p className="text-xs leading-relaxed text-foreground/85">
              {summary.big_idea}
            </p>
          )}
        </SummaryCard>
      )}

      {summary.key_verses.length > 0 && (
        <SummaryCard title="Key Verses">
          <ul className="flex flex-col gap-2">
            {summary.key_verses.map((v, i) => (
              <li
                key={i}
                className="rounded-md border border-primary/15 bg-primary/5 px-2.5 py-2"
              >
                <p className="text-xs font-semibold text-primary">
                  {v.reference}
                </p>
                {hasText(v.reason) && (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {v.reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </SummaryCard>
      )}

      {hasSermonFlow(summary) && (
        <SummaryCard title="Sermon Flow">
          <div className="flex flex-col gap-3">
            {hasText(summary.sermon_flow.opening) && (
              <SummaryField
                label="Opening"
                value={summary.sermon_flow.opening}
              />
            )}

            {summary.sermon_flow.main_points.length > 0 && (
              <div className="flex flex-col gap-2">
                {summary.sermon_flow.main_points.map((point, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-border bg-card/50 p-3"
                  >
                    <div className="flex gap-2">
                      <span className="shrink-0 text-[10px] font-semibold text-muted-foreground/70">
                        {i + 1}.
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs leading-relaxed font-semibold text-foreground">
                          {point.point}
                        </p>
                        {hasText(point.explanation) && (
                          <p className="mt-1 text-[11px] leading-relaxed text-foreground/80">
                            {point.explanation}
                          </p>
                        )}
                        {point.scripture_refs.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {point.scripture_refs.map((ref, refIndex) => (
                              <span
                                key={`${ref}-${refIndex}`}
                                className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                              >
                                {ref}
                              </span>
                            ))}
                          </div>
                        )}
                        {hasText(point.illustration_or_moment) && (
                          <SummaryField
                            label="Moment"
                            value={point.illustration_or_moment}
                            compact
                          />
                        )}
                        {hasText(point.application) && (
                          <SummaryField
                            label="Application"
                            value={point.application}
                            compact
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {hasText(summary.sermon_flow.conclusion) && (
              <SummaryField
                label="Conclusion"
                value={summary.sermon_flow.conclusion}
              />
            )}
            {hasText(summary.sermon_flow.response) && (
              <SummaryField
                label="Response"
                value={summary.sermon_flow.response}
              />
            )}
          </div>
        </SummaryCard>
      )}

      {summary.takeaways.length > 0 && (
        <SummaryCard title="Takeaways" tone="accent">
          <ul className="flex flex-col gap-1.5">
            {summary.takeaways.map((t, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs leading-relaxed text-foreground/85"
              >
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </SummaryCard>
      )}
    </div>
  )
}
