import { APP_LOGO_URL } from "./brand"
import type { ImageSlide } from "@/types"

export const SPEAKER_LOGO_MARK = APP_LOGO_URL
export const DEFAULT_SPEAKER_NAME = "Pastor John Kennedy"
export const DEFAULT_SPEAKER_PORTRAIT =
  "/service-slides/pastor-john-kennedy-starburst.png"

export function getSpeakerPortraitUrl(slide: ImageSlide | null | undefined) {
  const overlay = slide?.textOverlay
  return overlay?.layout === "title" &&
    overlay.body.trim().replace(/\s+/g, " ").toLowerCase() ===
      DEFAULT_SPEAKER_NAME.toLowerCase()
    ? DEFAULT_SPEAKER_PORTRAIT
    : undefined
}
