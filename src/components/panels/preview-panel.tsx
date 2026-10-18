import { PanelHeader } from "@/components/ui/panel-header"
import { InteractiveVersePreview } from "@/components/panels/interactive-verse-preview"
import { useBibleStore, useBroadcastStore, useQueueStore, useSettingsStore } from "@/stores"
import { verseTranslation } from "@/lib/queue-translation"
import { queueVerseToRenderData, toVerseRenderData } from "@/hooks/use-broadcast"
import type { TextHighlight } from "@/types"

export function PreviewPanel() {
  const selectedVerse = useBibleStore((s) => s.selectedVerse)
  const translations = useBibleStore((s) => s.translations)
  const previewVerse = useBroadcastStore((s) => s.previewVerse)
  const queueItems = useQueueStore((s) => s.items)
  const activeIndex = useQueueStore((s) => s.activeIndex)
  const defaultHighlightColor = useSettingsStore((s) => s.defaultHighlightColor)

  const themes = useBroadcastStore((s) => s.themes)
  const activeThemeId = useBroadcastStore((s) => s.activeThemeId)

  const activeTheme = themes.find((t) => t.id === activeThemeId) ?? themes[0]
  const translation = selectedVerse
    ? verseTranslation(selectedVerse, translations)
    : "Unknown"

  const activeItem = activeIndex === null ? null : queueItems[activeIndex]
  const activeVerseItem = activeItem?.kind === "verse" && selectedVerse &&
    activeItem.verse.translation_id === selectedVerse.translation_id &&
    activeItem.verse.book_number === selectedVerse.book_number &&
    activeItem.verse.chapter === selectedVerse.chapter &&
    activeItem.verse.verse === selectedVerse.verse
    ? activeItem
    : null
  const cleanVerseData = selectedVerse ? toVerseRenderData(selectedVerse, translation) : null
  const samePreview = cleanVerseData && previewVerse &&
    previewVerse.reference === cleanVerseData.reference
  const verseData = activeVerseItem
    ? queueVerseToRenderData(activeVerseItem)
    : samePreview
      ? previewVerse
      : cleanVerseData

  const handleHighlightsChange = (highlights: TextHighlight[]) => {
    if (!verseData) return
    const next = highlights.length > 0 ? { ...verseData, highlights } : { ...verseData, highlights: undefined }
    if (activeVerseItem) {
      useQueueStore.getState().updateVerseHighlights(activeVerseItem.id, highlights)
    }
    useBroadcastStore.getState().setPreviewVerse(next)
  }

  return (
    <div
      data-slot="preview-panel"
      className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-card"
    >
      <PanelHeader title="Program preview" />
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <InteractiveVersePreview
          key={`${verseData?.reference ?? "empty"}:${activeVerseItem?.id ?? "fresh"}`}
          theme={activeTheme}
          verse={verseData}
          defaultColor={defaultHighlightColor}
          onHighlightsChange={handleHighlightsChange}
        />
      </div>
    </div>
  )
}
