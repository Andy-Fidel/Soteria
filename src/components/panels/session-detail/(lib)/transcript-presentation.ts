import type { ImageSlide } from "@/types"
import type { GallerySlide } from "./session-slides"

export function transcriptArtwork(
  slides: GallerySlide[],
  title: string,
  speaker: string | null
): ImageSlide {
  return (
    slides.find((slide) => slide.image.textOverlay?.layout === "title")
      ?.image ?? {
      url: "/service-slides/starburst-black.png",
      label: title,
      textOverlay: { layout: "title", title, body: speaker ?? "" },
    }
  )
}

/** A title slide is always available, including sessions with no saved slides. */
export function sessionSlidesWithTitle(
  slides: GallerySlide[],
  sessionId: number,
  title: string,
  speaker: string | null
): GallerySlide[] {
  if (slides.some((slide) => slide.image.textOverlay?.layout === "title"))
    return slides
  const image = transcriptArtwork([], title, speaker)
  return [
    { key: `session-title-${sessionId}`, title, image, savedAt: "" },
    ...slides,
  ]
}

export function sessionStartedAtMs(value: string | null | undefined) {
  if (!value) return Number.NaN
  const iso = value.replace(" ", "T")
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`)
}

export function activeTranscriptId(
  segments: { id: number; seconds: number | null }[],
  seconds: number | null
) {
  if (seconds === null) return null
  let id: number | null = null
  for (const segment of segments) {
    if (segment.seconds !== null && segment.seconds <= seconds) id = segment.id
  }
  return id
}
