import { parsePlanItem, type ImageSlide } from "@/types"
import { prayerImageSlide } from "@/components/service-plan/(lib)/prayer-slide"

export interface SavedSessionSlide {
  id: number
  sessionId: number
  sourceItemId: number
  itemData: string
  savedAt: string
}
export interface GallerySlide {
  key: string
  title: string
  image: ImageSlide
  savedAt: string
}

export function expandSessionSlides(rows: SavedSessionSlide[]): GallerySlide[] {
  return rows.flatMap((row) => {
    const parsed = parsePlanItem({
      id: row.sourceItemId,
      planId: row.sessionId,
      planKind: "session",
      itemType: "blank",
      itemData: row.itemData,
      orderIndex: 0,
      autoAdvanceSeconds: null,
    })
    if (parsed?.type !== "blank" || !parsed.imageUrl) return []
    const prayer = parsed.prayer
    if (prayer)
      return prayer.points.map((point, index) => ({
        key: `${row.id}-${index}`,
        title: point,
        savedAt: row.savedAt,
        image: prayerImageSlide(row.sourceItemId, prayer, index),
      }))
    return [
      {
        key: String(row.id),
        savedAt: row.savedAt,
        title: parsed.textOverlay?.title || parsed.imageLabel || "Slide",
        image: {
          url: parsed.imageUrl,
          label: parsed.imageLabel ?? "Slide",
          textOverlay: parsed.textOverlay,
        },
      },
    ]
  })
}
