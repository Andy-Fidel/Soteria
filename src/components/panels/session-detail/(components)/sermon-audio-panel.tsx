import { useEffect, useState } from "react"
import { InfoIcon, SparklesIcon, ScissorsIcon } from "lucide-react"
import { listen } from "@tauri-apps/api/event"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatAudioTime } from "@/lib/session-audio-timeline"
import { AudioReviewPlayer } from "./audio-review-player"
import {
  formatCutTime,
  type AudioPublicationState,
} from "../(lib)/sermon-audio"
import { useSermonAudioEditor } from "../(hooks)/use-sermon-audio-editor"

function SermonAudioEditor({
  sessionId,
  startedAtMs,
  disabled,
  onChange,
}: {
  sessionId: number
  startedAtMs?: number
  disabled: boolean
  onChange: (state: AudioPublicationState) => void
}) {
  const { state, actions } = useSermonAudioEditor({
    sessionId,
    startedAtMs,
    disabled,
    onChange,
  })
  const {
    mode,
    info,
    cut,
    error,
    included,
    busy,
    start,
    end,
    valid,
    preparedMatches,
  } = state
  const { change, suggest, prepare, setCut, setIncluded } = actions
  return (
    <section aria-label="Sermon audio" className="space-y-4 border-t pt-5">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Sermon audio</h3>
          <span
            tabIndex={0}
            aria-label="Creates a separate MP3 with balanced volume. Original unchanged."
            title="Creates a separate MP3 with balanced volume. Original unchanged."
            className="text-muted-foreground"
          >
            <InfoIcon className="size-3.5" />
          </span>
        </div>
      </div>
      {mode === "loading" && (
        <p role="status" className="text-xs text-muted-foreground">
          Checking the recording…
        </p>
      )}
      {info && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !Number.isFinite(startedAtMs)}
              onClick={() => void suggest()}
            >
              <SparklesIcon className="size-3.5" />
              {mode === "suggesting" ? "Finding…" : "Auto-trim"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Original: {formatAudioTime(info.durationSeconds)}
            </span>
          </div>
          {cut.reason && (
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Why these cuts?</summary>
              <p className="mt-2 leading-relaxed">{cut.reason}</p>
            </details>
          )}
          <AudioReviewPlayer
            sessionId={sessionId}
            start={start}
            end={end}
            onMark={
              busy
                ? undefined
                : (point, seconds) => change(point, formatCutTime(seconds))
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1.5 text-xs font-medium">
              Start
              <Input
                value={cut.start}
                disabled={busy}
                onChange={(event) => change("start", event.target.value)}
                placeholder="00:00"
              />
            </label>
            <label className="space-y-1.5 text-xs font-medium">
              End
              <Input
                value={cut.end}
                disabled={busy}
                onChange={(event) => change("end", event.target.value)}
                placeholder="00:00"
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {valid && start !== null && end !== null
              ? `Duration · ${formatAudioTime(end - start)}`
              : "Select at least 3 seconds."}
          </p>
          <label className="flex items-start gap-2 text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={cut.reviewed}
              disabled={busy || !valid}
              onChange={(event) =>
                setCut((cut) => ({ ...cut, reviewed: event.target.checked }))
              }
              className="mt-0.5"
            />
            Cut points reviewed
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !valid || !cut.reviewed}
            onClick={() => void prepare()}
          >
            <ScissorsIcon className="size-3.5" />
            {mode === "preparing" ? "Preparing…" : "Prepare MP3"}
          </Button>
          {info.prepared && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs font-medium">
                Prepared MP3 · {formatAudioTime(info.prepared.durationSeconds)}{" "}
                · {(info.prepared.bytes / 1_000_000).toFixed(1)} MB
              </p>
              <AudioReviewPlayer
                key={info.prepared.revision}
                sessionId={sessionId}
                revision={info.prepared.revision}
              />
              {!preparedMatches && (
                <p className="text-xs text-muted-foreground">
                  Cuts changed. Prepare again to include audio.
                </p>
              )}
              <label className="flex items-start gap-2 text-xs leading-relaxed">
                <input
                  type="checkbox"
                  disabled={busy || !preparedMatches}
                  checked={included}
                  onChange={(event) => {
                    setIncluded(event.target.checked)
                    onChange(
                      event.target.checked
                        ? {
                            mode: "included",
                            revision: info.prepared!.revision,
                          }
                        : { mode: "excluded" }
                    )
                  }}
                  className="mt-0.5"
                />
                Include audio in recap
              </label>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

export function AudioUploadProgress({ sessionId }: { sessionId: number }) {
  const [progress, setProgress] = useState<number | null>(null)
  useEffect(() => {
    const subscription = listen<{
      sessionId: number
      completedBytes: number
      totalBytes: number
    }>("sermon-audio:upload-progress", ({ payload }) => {
      if (payload.sessionId === sessionId && payload.totalBytes > 0)
        setProgress(
          Math.min(
            100,
            Math.round((payload.completedBytes / payload.totalBytes) * 100)
          )
        )
    })
    return () => {
      void subscription.then((unlisten) => unlisten())
    }
  }, [sessionId])
  return (
    <p role="status" className="text-xs text-muted-foreground">
      {progress === null
        ? "Preparing to upload reviewed audio…"
        : progress < 100
          ? `Uploading reviewed audio… ${progress}%`
          : "Audio uploaded. Finishing publication…"}
    </p>
  )
}

/** Loading a full recording is an explicit action, never a cost of opening a recap. */
export function SermonAudioPanel(
  props: Parameters<typeof SermonAudioEditor>[0]
) {
  const [open, setOpen] = useState(false)
  if (open) return <SermonAudioEditor {...props} />
  return (
    <section aria-label="Sermon audio" className="space-y-3 border-t pt-5">
      <h3 className="text-sm font-semibold">Sermon audio</h3>
      <Button
        size="sm"
        variant="outline"
        disabled={props.disabled}
        onClick={() => setOpen(true)}
      >
        Review sermon audio
      </Button>
    </section>
  )
}
