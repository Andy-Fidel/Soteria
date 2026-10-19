import { useId, useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SermonFlow } from "@/lib/summarize"
import { hasText } from "../(lib)/summary"
import { SummaryCard, SummaryField } from "./summary-card"

export function SummaryOutline({ flow }: { flow: SermonFlow }) {
  const id = useId()
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]))
  const allExpanded = flow.main_points.every((_, index) => expanded.has(index))
  return (
    <SummaryCard
      title="Sermon outline"
      action={
        flow.main_points.length > 0 && (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() =>
              setExpanded(
                allExpanded
                  ? new Set()
                  : new Set(flow.main_points.map((_, index) => index))
              )
            }
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
        )
      }
    >
      {hasText(flow.opening) && (
        <SummaryField label="Opening" value={flow.opening} />
      )}
      {flow.main_points.length > 0 && (
        <div className="border-t border-border">
          {flow.main_points.map((point, index) => {
            const open = expanded.has(index)
            const triggerId = `${id}-trigger-${index}`
            const panelId = `${id}-panel-${index}`
            return (
              <div key={index} className="border-b border-border">
                <h3>
                  <button
                    id={triggerId}
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex w-full items-start gap-3 rounded-sm py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    onClick={() =>
                      setExpanded((current) => {
                        const next = new Set(current)
                        if (next.has(index)) next.delete(index)
                        else next.add(index)
                        return next
                      })
                    }
                  >
                    <span className="w-5 shrink-0 text-sm leading-relaxed text-primary">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1 text-base leading-snug font-semibold tracking-tight">
                      {point.point}
                    </span>
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-180 ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  aria-hidden={!open}
                  inert={!open}
                  className={`grid transition-[grid-template-rows,visibility] duration-180 ease-out motion-reduce:transition-none ${open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="pb-6 sm:pl-8">
                      {hasText(point.explanation) && (
                        <p className="text-sm leading-relaxed">
                          {point.explanation}
                        </p>
                      )}
                      {point.scripture_refs.length > 0 && (
                        <ul
                          aria-label="Scripture references"
                          className="mt-4 flex flex-wrap gap-2"
                        >
                          {point.scripture_refs.map((reference, refIndex) => (
                            <li
                              key={refIndex}
                              className="rounded bg-primary/5 px-2 py-1 text-sm font-medium text-primary"
                            >
                              {reference}
                            </li>
                          ))}
                        </ul>
                      )}
                      {hasText(point.illustration_or_moment) && (
                        <SummaryField
                          label="Illustration"
                          value={point.illustration_or_moment}
                          compact
                        />
                      )}
                      {hasText(point.application) && (
                        <SummaryField
                          label="Put it into practice"
                          value={point.application}
                          compact
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {hasText(flow.conclusion) && (
        <SummaryField label="Conclusion" value={flow.conclusion} />
      )}
      {hasText(flow.response) && (
        <SummaryField label="Response" value={flow.response} />
      )}
    </SummaryCard>
  )
}
