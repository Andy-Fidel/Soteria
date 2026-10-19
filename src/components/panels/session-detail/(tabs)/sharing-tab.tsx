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
import { formatSermonSms } from "../(lib)/publication"
import { smsMetrics } from "../(lib)/sharing-drafts"
import type { useSharingDrafts } from "../(hooks)/use-sharing-drafts"
import { PublicationActions } from "../(components)/publication-actions"
import { RecapEditor } from "../(components)/recap-editor"
import { SmsAlternatives } from "../(components)/sms-alternatives"
import { SmsSendAction } from "../(components)/sms-send-action"

export function SharingTab({
  kind,
  sharing,
  summary,
  title,
  speaker,
  summarizing,
}: {
  kind: "public-recap" | "sms"
  sharing: ReturnType<typeof useSharingDrafts>
  summary: SermonSummary | null
  title: string
  speaker?: string | null
  summarizing: boolean
}) {
  const [copyState, setCopyState] = useState("")
  const { draft, operation, error, dirty } = sharing
  const busy = operation !== "idle"
  const isSms = kind === "sms"
  const label = isSms ? "SMS" : "Public Recap"
  const hasDraft = Boolean(isSms ? draft.sms : draft.title || draft.recap)
  const canGenerate = summary && hasSermonContent(summary) && !summarizing
  const formattedSms = formatSermonSms(draft.sms)
  const metrics = smsMetrics(formattedSms)
  const words = draft.recap.trim() ? draft.recap.trim().split(/\s+/).length : 0
  const copy = async (kind: "recap" | "sms") => {
    try {
      await navigator.clipboard.writeText(
        kind === "sms" ? formattedSms : `${draft.title}\n\n${draft.recap}`
      )
      setCopyState(kind === "sms" ? "SMS copied" : "Recap copied")
    } catch {
      setCopyState("Could not copy. Select the text and copy it manually.")
    }
  }
  return (
    <div
      aria-label={label}
      className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-5 px-5 py-7 sm:px-8 sm:py-9"
    >
      <div>
        <h2 className="text-base font-semibold tracking-tight">{label}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {isSms
            ? "Review your message, preview the cost, and send it to your saved contact list."
            : "Prepare and publish a short recap for your church."}
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
                if (!summary) return
                if (isSms) void sharing.generateSmsAlternatives(summary, title)
                else void sharing.generate(summary, title, speaker, "recap")
              }}
              title={
                !isSms && hasDraft
                  ? `Replaces the ${isSms ? "SMS" : "recap"} draft. Save or copy your edits first.`
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
                : isSms
                  ? sharing.smsAlternatives.length
                    ? "Generate new alternatives"
                    : "Generate 3 alternatives"
                  : hasDraft
                    ? `Regenerate ${isSms ? "SMS" : "recap"}`
                    : `Generate ${isSms ? "SMS" : "recap"}`}
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
              Save changes
            </Button>
          </div>
          {!canGenerate && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Generate a summary with sermon teaching to create AI drafts. You
              can also write your own below.
            </p>
          )}
          {!isSms && (
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
              <RecapEditor
                value={draft.recap}
                disabled={busy}
                onChange={(value) => sharing.update("recap", value)}
              />
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
          )}
          {isSms && (
            <SmsAlternatives
              options={sharing.smsAlternatives}
              selectedMessage={formattedSms}
              disabled={busy}
              onSelect={(message) => sharing.update("sms", message)}
            />
          )}
          {isSms && (
            <section aria-label="SMS draft" className="space-y-3">
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
                  onBlur={() => {
                    if (draft.sms !== formattedSms)
                      sharing.update("sms", formattedSms)
                  }}
                  disabled={busy}
                  maxLength={2000}
                  onChange={(event) =>
                    sharing.update("sms", event.target.value)
                  }
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
              <SmsSendAction
                sessionId={sharing.sessionId}
                message={formattedSms}
                disabled={busy || !draft.sms.trim()}
              />
            </section>
          )}
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
    </div>
  )
}
