import { Button } from "@/components/ui/button"
import {
  SparklesIcon,
  LoaderIcon,
  RefreshCwIcon,
  CheckIcon,
  CopyIcon,
} from "lucide-react"
import type { SermonSummary } from "@/lib/summarize"
import { SummaryNarrative } from "../(components)/summary-narrative"
import { SummaryFollowUp } from "../(components)/summary-follow-up"
import { SummaryExportMenu } from "../(components)/summary-export-menu"
interface SummaryTabProps {
  summary: SermonSummary | null
  summarizing: boolean
  summaryError: string | null
  summaryCopied: boolean
  transcript: { text: string }[]
  session: { speaker?: string | null } | null
  handleSummarize: () => void
  handleCopySummary: () => void
}
export function SummaryTab({
  summary,
  summarizing,
  summaryError,
  summaryCopied,
  transcript,
  session,
  handleSummarize,
  handleCopySummary,
}: SummaryTabProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-9 px-5 py-7 [overflow-wrap:anywhere] sm:px-10 sm:py-9">
      {!summary && !summarizing && !summaryError && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-8 text-center">
          <SparklesIcon className="size-6 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">No summary yet.</p>
          <Button
            size="sm"
            onClick={handleSummarize}
            disabled={transcript.length === 0}
            className="gap-1.5"
          >
            <SparklesIcon className="size-3.5" />
            Generate summary
          </Button>
          {transcript.length === 0 && (
            <p className="text-[10px] text-muted-foreground/70">
              Record some transcript first.
            </p>
          )}
        </div>
      )}

      {summarizing && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3"
        >
          <LoaderIcon className="size-3.5 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">
            Summarizing transcript…
          </p>
        </div>
      )}

      {summaryError && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-xs text-red-500">{summaryError}</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSummarize}
            className="mt-2 gap-1.5"
          >
            <RefreshCwIcon className="size-3" />
            Retry
          </Button>
        </div>
      )}

      {summary && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <SparklesIcon className="size-3.5 text-primary" />
              <span className="text-sm font-medium text-primary">
                AI summary
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySummary}
                title="Copy summary as markdown"
              >
                {summaryCopied ? (
                  <CheckIcon className="size-3 text-primary" />
                ) : (
                  <CopyIcon className="size-3" />
                )}
                <span aria-live="polite">
                  {summaryCopied ? "Copied" : "Copy summary"}
                </span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSummarize}
                title="Regenerate"
                disabled={summarizing}
              >
                <RefreshCwIcon className="size-3" />
                Regenerate
              </Button>
              <SummaryExportMenu summary={summary} speaker={session?.speaker} />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-10">
            <SummaryNarrative summary={summary} />
            <SummaryFollowUp summary={summary} speaker={session?.speaker} />
          </div>
          <p className="border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
            AI-generated summary. Review alongside the original transcript.
          </p>
        </>
      )}
    </div>
  )
}
