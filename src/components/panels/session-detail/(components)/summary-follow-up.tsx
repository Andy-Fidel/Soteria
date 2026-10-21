import { useState } from "react"
import { CopyIcon, CheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SermonSummary, SermonQuote } from "@/lib/summarize"
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
    <div className="flex min-w-0 flex-col gap-9">
      {hasDevotional(summary) && (
        <SummaryCard title="Take it into your week">
          <p className="text-sm leading-relaxed text-muted-foreground">
            A devotional reflection based on the teaching.
          </p>
          {hasText(summary.devotional.scripture) && (
            <blockquote className="border-l-2 border-primary/25 pl-5 font-serif text-base leading-relaxed">
              {summary.devotional.scripture}
            </blockquote>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            {hasText(summary.devotional.observation) && (
              <SummaryField
                label="Consider"
                value={summary.devotional.observation}
              />
            )}
            {hasText(summary.devotional.application) && (
              <SummaryField
                label="Respond"
                value={summary.devotional.application}
              />
            )}
          </div>
          {summary.devotional.reflection_questions.length > 0 && (
            <div className="rounded-lg bg-primary/5 p-5">
              <h3 className="text-sm font-semibold">
                Questions for reflection
              </h3>
              <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
                {summary.devotional.reflection_questions.map(
                  (question, index) => (
                    <li key={index} className="pl-1">
                      {question}
                    </li>
                  )
                )}
              </ol>
            </div>
          )}
          {hasText(summary.devotional.prayer) && (
            <SummaryField label="Prayer" value={summary.devotional.prayer} />
          )}
        </SummaryCard>
      )}
      <SummaryCard title="Words to remember">
        {summary.quotes.length > 0 ? (
          <ul className="flex flex-col gap-6">
            {summary.quotes.map((quote, index) => (
              <SummaryQuote key={index} quote={quote} speaker={speaker} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No notable spoken quotes captured.
          </p>
        )}
      </SummaryCard>
    </div>
  )
}

function SummaryQuote({
  quote,
  speaker,
}: {
  quote: SermonQuote
  speaker?: string | null
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle"
  )
  const attribution = quoteSpeaker(quote.speaker, speaker)
  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(`“${quote.text}” — ${attribution}`)
      setCopyStatus("copied")
    } catch {
      setCopyStatus("error")
    }
  }
  return (
    <li className="border-t border-border pt-5 first:border-0 first:pt-0">
      <blockquote>
        <p className="font-serif text-lg leading-relaxed">“{quote.text}”</p>
        <footer className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <cite className="text-sm text-muted-foreground not-italic">
            {attribution}
          </cite>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={copyQuote}
            aria-label="Copy quote"
          >
            {copyStatus === "copied" ? (
              <CheckIcon aria-hidden="true" />
            ) : (
              <CopyIcon aria-hidden="true" />
            )}
            {copyStatus === "copied" ? "Copied" : "Copy"}
          </Button>
        </footer>
      </blockquote>
      <p role="status" className="text-sm text-muted-foreground">
        {copyStatus === "error"
          ? "Could not copy. Select the quote and copy it manually."
          : copyStatus === "copied"
            ? "Quote copied."
            : ""}
      </p>
    </li>
  )
}
