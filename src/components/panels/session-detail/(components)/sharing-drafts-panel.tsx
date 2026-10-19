import { useState } from "react"
import {
  CopyIcon,
  LoaderIcon,
  RefreshCwIcon,
  SaveIcon,
  SparklesIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { SermonSummary } from "@/lib/summarize"
import { hasSermonContent } from "@/lib/summarize"
import { smsMetrics } from "../(lib)/sharing-drafts"
import type { useSharingDrafts } from "../(hooks)/use-sharing-drafts"
import { PublicationActions } from "./publication-actions"
import { RecapEditor } from "./recap-editor"

export function SharingDraftsPanel({
  sharing,
  summary,
  title,
  speaker,
  summarizing,
}: {
  sharing: ReturnType<typeof useSharingDrafts>
  summary: SermonSummary | null
  title: string
  speaker?: string | null
  summarizing: boolean
}) {
  const [copyState, setCopyState] = useState("")
  const { draft, operation, error, dirty } = sharing
  const busy = operation !== "idle"
  const hasDraft = Boolean(draft.title || draft.recap || draft.sms)
  const canGenerate = summary && hasSermonContent(summary) && !summarizing
  const metrics = smsMetrics(draft.sms)
  const words = draft.recap.trim() ? draft.recap.trim().split(/\s+/).length : 0
  const copy = async (kind: "recap" | "sms") => {
    try {
      await navigator.clipboard.writeText(
        kind === "sms" ? draft.sms : `${draft.title}\n\n${draft.recap}`
      )
      setCopyState(kind === "sms" ? "SMS copied" : "Recap copied")
    } catch {
      setCopyState("Could not copy. Select the text and copy it manually.")
    }
  }
  return (
    <aside
      aria-label="Sharing drafts"
      className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-card/60 p-5"
    >
      <div>
        <h2 className="text-base font-semibold tracking-tight">
          Sharing drafts
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Prepare a short recap and a message for your church. Review, then save
          them with this session.
        </p>
      </div>
      {operation === "loading" ? (
        <p role="status" className="text-xs text-muted-foreground">
          Loading drafts…
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!canGenerate || busy}
              onClick={() => {
                if (summary) void sharing.generate(summary, title, speaker)
              }}
              title={
                hasDraft
                  ? "Replaces both draft fields. Save or copy your edits first."
                  : undefined
              }
            >
              {operation === "generating" ? (
                <LoaderIcon className="size-3.5 animate-spin" />
              ) : hasDraft ? (
                <RefreshCwIcon className="size-3.5" />
              ) : (
                <SparklesIcon className="size-3.5" />
              )}
              {operation === "generating"
                ? "Generating…"
                : hasDraft
                  ? "Regenerate drafts"
                  : "Generate drafts"}
            </Button>
            <Button
              size="sm"
              disabled={!dirty || busy}
              onClick={() => void sharing.save()}
            >
              {operation === "saving" ? (
                <LoaderIcon className="size-3.5 animate-spin" />
              ) : (
                <SaveIcon className="size-3.5" />
              )}{" "}
              Save drafts
            </Button>
          </div>
          {!canGenerate && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Generate a summary with sermon teaching to create AI drafts. You
              can also write your own below.
            </p>
          )}
          <section aria-label="Sermon recap draft" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Sermon recap</h3>
              <Button
                size="sm"
                variant="ghost"
                disabled={!draft.recap}
                onClick={() => void copy("recap")}
              >
                <CopyIcon className="size-3" />
                Copy
              </Button>
            </div>
            <label className="block space-y-1.5 text-xs font-medium">
              Title
              <Input
                value={draft.title}
                disabled={busy}
                maxLength={200}
                onChange={(event) =>
                  sharing.update("title", event.target.value)
                }
                placeholder="Sermon title"
              />
            </label>
            <RecapEditor value={draft.recap} disabled={busy} onChange={(value) => sharing.update("recap", value)} />
            <p className="text-[11px] text-muted-foreground">
              {words} words · Suggested length: 240–360
            </p>
            <PublicationActions
              publication={sharing.publication}
              disabled={busy || !draft.title.trim() || !draft.recap.trim()}
              publishing={operation === "publishing"}
              onPublish={() => void sharing.publish(title, speaker)}
            />
          </section>
          <section
            aria-label="SMS draft"
            className="space-y-3 border-t border-border pt-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">SMS</h3>
              <Button
                size="sm"
                variant="ghost"
                disabled={!draft.sms}
                onClick={() => void copy("sms")}
              >
                <CopyIcon className="size-3" />
                Copy
              </Button>
            </div>
            <label className="block space-y-1.5 text-xs font-medium">
              Message
              <textarea
                value={draft.sms}
                disabled={busy}
                maxLength={2000}
                onChange={(event) => sharing.update("sms", event.target.value)}
                placeholder="One takeaway to carry into the week…"
                className="min-h-28 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-relaxed disabled:opacity-60"
              />
            </label>
            <p
              role="status"
              className={`text-xs ${metrics.segments > 1 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
            >
              {metrics.units}/{metrics.limit} · {metrics.segments} SMS{" "}
              {metrics.segments === 1 ? "part" : "parts"} · {metrics.encoding}
            </p>
            {metrics.encoding === "Unicode" && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                This text uses Unicode. One SMS holds 70 units; emoji can use
                two units each.
              </p>
            )}
            {metrics.segments > 1 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Shorten this message to keep it in one SMS.
              </p>
            )}
          </section>
          <p role="status" className="text-xs text-muted-foreground">
            {dirty
              ? "Unsaved changes"
              : hasDraft
                ? "Saved on this device"
                : "Drafts are saved on this device"}
          </p>
        </>
      )}
      {error && (
        <div role="alert" className="space-y-2 text-xs text-destructive">
          <p>{error}</p>
          {operation === "load-error" && (
            <Button size="sm" variant="outline" onClick={sharing.retry}>
              Try again
            </Button>
          )}
        </div>
      )}
      {copyState && (
        <p role="status" className="text-xs text-muted-foreground">
          {copyState}
        </p>
      )}
    </aside>
  )
}
