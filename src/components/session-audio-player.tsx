import { useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { PauseIcon, PlayIcon, RotateCcwIcon, RotateCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { onAudioSeek } from "@/hooks/use-audio-seek"
import {
  sessionAudioSeekSeconds,
  formatAudioTime,
  type SessionAudioSpan,
} from "@/lib/session-audio-timeline"

interface Props {
  /** Session id — audio bytes are fetched over IPC and played from a Blob. */
  sessionId: number
  /**
   * The session's `started_at` epoch milliseconds. Transcript segment
   * timestamps use wall-clock ms since UNIX epoch. Used as a fallback for
   * old recordings that have no persisted audio timeline.
   */
  startedAtMs: number
  onTimelineLoaded?: (spans: SessionAudioSpan[]) => void
  onPlaybackTime?: (seconds: number) => void
  onReady?: (ready: boolean) => void
}

/**
 * Plays a session recording from an in-memory Blob URL.
 *
 * We deliberately do NOT use `convertFileSrc()` / the `asset:` protocol: on
 * macOS WKWebView the asset protocol mishandles media range requests, so
 * seeking a longer recording re-reads from byte 0 and crashes the WebView
 * renderer (tauri-apps/tauri#6375, #4826). Fetching the bytes once and serving
 * them as a `blob:` URL lets the media element seek in-memory — no custom-scheme
 * range requests, no crash.
 */
export function SessionAudioPlayer(props: Props) {
  return <LoadedSessionAudioPlayer key={props.sessionId} {...props} />
}

function LoadedSessionAudioPlayer({
  sessionId,
  startedAtMs,
  onTimelineLoaded,
  onPlaybackTime,
  onReady,
}: Props) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<SessionAudioSpan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)

  // Fetch audio bytes once and build a Blob URL. Revoke on unmount / change.
  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    onReady?.(false)
    void Promise.all([
      invoke<ArrayBuffer>("read_session_audio", { sessionId }),
      invoke<SessionAudioSpan[]>("get_session_audio_timeline", {
        sessionId,
      }),
    ])
      .then(([buf, spans]) => {
        if (cancelled) return
        const blob = new Blob([buf], { type: "audio/mpeg" })
        url = URL.createObjectURL(blob)
        setTimeline(spans)
        onTimelineLoaded?.(spans)
        setBlobUrl(url)
      })
      .catch((e) => {
        if (!cancelled)
          setError(typeof e === "string" ? e : "Failed to load audio")
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [sessionId, onTimelineLoaded, onReady])

  // Click-to-seek from transcript segments.
  useEffect(() => {
    return onAudioSeek((segmentMs) => {
      const el = ref.current
      if (!el) return
      const offsetSec = sessionAudioSeekSeconds(
        segmentMs,
        startedAtMs,
        timeline,
        el.duration
      )
      if (offsetSec === null) return
      el.currentTime = offsetSec
      void el.play().catch(() => {})
    })
  }, [startedAtMs, timeline])

  const seek = (seconds: number) => {
    const audio = ref.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = Math.min(audio.duration, Math.max(0, seconds))
    setPosition(audio.currentTime)
    onPlaybackTime?.(audio.currentTime)
  }
  const togglePlayback = async () => {
    const audio = ref.current
    if (!audio) return
    if (!audio.paused) audio.pause()
    else {
      try {
        await audio.play()
      } catch {
        setError("Could not play this recording.")
        onReady?.(false)
      }
    }
  }

  if (error) {
    return (
      <p className="text-xs text-muted-foreground">
        Audio unavailable: {error}
      </p>
    )
  }
  if (!blobUrl) {
    return <p className="text-xs text-muted-foreground">Loading audio…</p>
  }

  return (
    <div aria-label="Session audio player" className="mt-5">
      <audio
        ref={ref}
        preload="metadata"
        src={blobUrl}
        className="hidden"
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration
          const ready = Number.isFinite(value) && value > 0
          setDuration(ready ? value : 0)
          onReady?.(ready)
        }}
        onTimeUpdate={(event) => {
          const seconds = event.currentTarget.currentTime
          setPosition(seconds)
          onPlaybackTime?.(seconds)
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setError("This recording could not be loaded.")
          onReady?.(false)
        }}
      />
      <input
        type="range"
        aria-label="Recording position"
        min={0}
        max={duration || 1}
        step={0.1}
        value={position}
        disabled={!duration}
        onChange={(event) => seek(Number(event.target.value))}
        className="h-4 w-full accent-primary"
      />
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{formatAudioTime(position)}</span>
        <span>{formatAudioTime(duration)}</span>
      </div>
      <div className="mt-4 flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          disabled={!duration}
          aria-label="Back 15 seconds"
          onClick={() => seek(position - 15)}
        >
          <RotateCcwIcon className="size-4" />
        </Button>
        <Button
          size="icon"
          disabled={!duration}
          className="size-12 rounded-full"
          aria-label={playing ? "Pause recording" : "Play recording"}
          onClick={() => void togglePlayback()}
        >
          {playing ? (
            <PauseIcon className="size-5" />
          ) : (
            <PlayIcon className="size-5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!duration}
          aria-label="Forward 15 seconds"
          onClick={() => seek(position + 15)}
        >
          <RotateCwIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
