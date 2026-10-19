import { memo, useEffect, useMemo, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import {
  expandSessionSlides,
  type GallerySlide,
  type SavedSessionSlide,
} from "../(lib)/session-slides"
import { transcriptArtwork } from "../(lib)/transcript-presentation"

export const TranscriptArtwork = memo(function TranscriptArtwork({
  sessionId,
  title,
  speaker,
}: {
  sessionId: number
  title: string
  speaker: string | null
}) {
  const [slides, setSlides] = useState<GallerySlide[]>([])
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    let cancelled = false
    invoke<SavedSessionSlide[]>("get_session_slides", { sessionId })
      .then((rows) => {
        if (!cancelled) setSlides(expandSessionSlides(rows))
      })
      .catch(() => {
        if (!cancelled) setUnavailable(true)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])
  const artwork = useMemo(
    () => transcriptArtwork(slides, title, speaker),
    [slides, title, speaker]
  )
  return (
    <>
      <div
        role="img"
        aria-label={artwork.textOverlay?.title || title}
        className="aspect-video overflow-hidden rounded-lg bg-black"
      >
        <CanvasVerse
          theme={BUILTIN_THEMES[0]}
          verse={null}
          fullscreenImage={artwork}
        />
      </div>
      {unavailable && (
        <p className="mt-2 text-xs text-muted-foreground">
          Saved artwork unavailable. Showing the session title.
        </p>
      )}
    </>
  )
})
