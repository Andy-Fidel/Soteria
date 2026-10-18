import type { QueueItem, Translation, Verse } from "@/types"

export function verseTranslation(
  verse: Verse,
  translations: Translation[]
): string {
  return (
    translations.find((translation) => translation.id === verse.translation_id)
      ?.abbreviation ?? "Unknown"
  )
}

export function queueItemTranslation(
  item: QueueItem,
  translations: Translation[]
): string | null {
  if (item.kind !== "verse") return null

  return (
    translations.find(
      (translation) => translation.id === item.verse.translation_id
    )?.abbreviation ?? null
  )
}
