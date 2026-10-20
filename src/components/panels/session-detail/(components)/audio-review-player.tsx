import { useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import { PlayIcon, PanelLeftCloseIcon, PanelRightCloseIcon } from "lucide-react"

export function AudioReviewPlayer({
  sessionId,
  revision,
  start,
  end,
  onMark,
}: {
  sessionId: number
  revision?: string
  start?: number | null
  end?: number | null
  onMark?: (point: "start" | "end", seconds: number) => void
}) {
  const audio = useRef<HTMLAudioElement>(null)
  const [source, setSource] = useState<string | null>(null)
  const [error, setError] = useState("")
  const stopAt = useRef<number | null>(null)
  useEffect(() => {
    let cancelled = false
    let url: string | undefined
    void invoke<ArrayBuffer>(
      revision ? "read_prepared_sermon_audio" : "read_session_audio",
      { sessionId }
    )
      .then((bytes) => {
        if (cancelled) return
        url = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }))
        setSource(url)
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this recording for playback.")
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [sessionId, revision])
  const listen = (point: "start" | "end") => {
    const player = audio.current
    const boundary = point === "start" ? start : end
    if (!player || boundary === null || boundary === undefined) return
    player.pause()
    player.currentTime = Math.max(0, boundary - 5)
    stopAt.current = Math.min(player.duration || Infinity, boundary + 8)
    void player
      .play()
      .catch(() => setError("Press Play to listen to this point."))
  }
  return (
    <div className="space-y-2">
      {source ? (
        <audio
          ref={audio}
          controls
          preload="metadata"
          src={source}
          className="w-full"
          aria-label={
            revision
              ? "Prepared sermon recording"
              : "Original session recording"
          }
          onTimeUpdate={() => {
            const player = audio.current
            if (
              player &&
              stopAt.current !== null &&
              player.currentTime >= stopAt.current
            ) {
              player.pause()
              stopAt.current = null
            }
          }}
        />
      ) : (
        !error && (
          <p className="text-xs text-muted-foreground">Loading recording…</p>
        )
      )}
      {onMark && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!source || start == null}
            title="Listen around start"
            aria-label="Listen around start"
            onClick={() => listen("start")}
          >
            <PlayIcon className="size-3" /> Start
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!source || end == null}
            title="Listen around end"
            aria-label="Listen around end"
            onClick={() => listen("end")}
          >
            <PlayIcon className="size-3" /> End
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!source}
            title="Set start at playhead"
            aria-label="Set start at playhead"
            onClick={() => onMark("start", audio.current?.currentTime ?? 0)}
          >
            <PanelLeftCloseIcon className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!source}
            title="Set end at playhead"
            aria-label="Set end at playhead"
            onClick={() => onMark("end", audio.current?.currentTime ?? 0)}
          >
            <PanelRightCloseIcon className="size-3.5" />
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
