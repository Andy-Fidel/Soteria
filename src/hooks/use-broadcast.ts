import { useBroadcastStore } from "@/stores/broadcast-store"
import { useBibleStore } from "@/stores/bible-store"
import { invoke } from "@tauri-apps/api/core"
import type { Book, QueueItem, VerseRenderData } from "@/types"
import type { Verse } from "@/types"
import { validHighlights } from "@/lib/text-highlights"
import { verseTranslation } from "@/lib/queue-translation"
import { useSettingsStore } from "@/stores/settings-store"
import { splitVerseIntoChunks, wordCount } from "@/lib/verse-splitter"

export function toVerseRenderData(
  verse: Verse,
  translation: string,
  overrides?: { bodyText?: string; referenceOverride?: string }
): VerseRenderData {
  const reference = overrides?.referenceOverride
    ? overrides.referenceOverride
    : `${verse.book_name} ${verse.chapter}:${verse.verse} (${translation})`
  const text = overrides?.bodyText ?? verse.text
  return {
    reference,
    segments: [{ text, verseNumber: verse.verse }],
  }
}

export function queueVerseToRenderData(
  item: Extract<QueueItem, { kind: "verse" }>
): VerseRenderData {
  const translation = verseTranslation(
    item.verse,
    useBibleStore.getState().translations
  )
  const result = item.chunk
    ? toVerseRenderData(item.verse, translation, {
        bodyText: item.chunk.text,
        referenceOverride: `${item.reference} (${translation})`,
      })
    : toVerseRenderData(item.verse, translation)
  const text = result.segments[0]?.text ?? ""
  const highlights = validHighlights(text, item.highlights ?? [])
  return highlights.length > 0 ? { ...result, highlights } : result
}

export function deriveLiveVerse({
  isLive,
  selectedVerse,
  translation,
}: {
  isLive: boolean
  selectedVerse: Verse | null
  translation: string
}): VerseRenderData | null {
  if (!isLive || !selectedVerse) return null
  return toVerseRenderData(selectedVerse, translation)
}

const parseRef = (ref: string) => {
  const match = ref.match(/^(.+?)\s+(\d+):(\d+)/)
  if (!match) return null
  return {
    bookName: match[1],
    chapter: parseInt(match[2]),
    verse: parseInt(match[3]),
  }
}

export async function retranslateBroadcastVerses(
  translationId: number,
  abbreviation: string,
  options: { isCurrent?: () => boolean; onFailure?: () => void } = {}
) {
  let books = useBibleStore.getState().books
  if (books.length === 0) {
    try {
      books = await invoke<Book[]>("list_books", { translationId })
      if (options.isCurrent?.() === false) return
      useBibleStore.getState().setBooks(books)
    } catch (err) {
      console.warn("[retranslate] failed to load books:", err)
    }
  }
  const broadcast = useBroadcastStore.getState()

  const refetch = async (
    current: VerseRenderData | null
  ): Promise<VerseRenderData | null> => {
    if (!current) return null
    const parsed = parseRef(current.reference)
    if (!parsed) return null
    const target = parsed.bookName.toLowerCase()
    const book =
      books.find((b) => b.name === parsed.bookName) ??
      books.find((b) => b.name.toLowerCase() === target) ??
      books.find((b) => b.abbreviation?.toLowerCase() === target)
    if (!book) {
      console.warn(
        "[retranslate] book lookup failed for",
        parsed.bookName,
        "— available names:",
        books.map((b) => b.name)
      )
      return null
    }
    const v = await invoke<Verse | null>("get_verse", {
      translationId,
      bookNumber: book.book_number,
      chapter: parsed.chapter,
      verse: parsed.verse,
    })
    if (!v) {
      console.warn("[retranslate] get_verse returned null:", {
        translationId,
        bookNumber: book.book_number,
        chapter: parsed.chapter,
        verse: parsed.verse,
      })
      return null
    }
    const settings = useSettingsStore.getState()
    const chunks =
      settings.autoSplitLongVerses &&
      wordCount(v.text) > settings.splitWordThreshold
        ? splitVerseIntoChunks(v.text)
        : [v.text]
    if (chunks.length === 1) return toVerseRenderData(v, abbreviation)

    const oldPart = current.reference.match(/\((\d+)\/(\d+)\)/)
    const part =
      oldPart && Number(oldPart[2]) > 0
        ? Math.floor(
            ((Number(oldPart[1]) - 1) / Number(oldPart[2])) * chunks.length
          )
        : 0
    const index = Math.max(0, Math.min(part, chunks.length - 1))
    return toVerseRenderData(v, abbreviation, {
      bodyText: chunks[index],
      referenceOverride: `${v.book_name} ${v.chapter}:${v.verse} (${index + 1}/${chunks.length}) (${abbreviation})`,
    })
  }

  const [liveResult, previewResult] = await Promise.allSettled([
    refetch(broadcast.liveVerse),
    refetch(broadcast.previewVerse),
  ])
  const nextLive = liveResult.status === "fulfilled" ? liveResult.value : null
  const nextPreview =
    previewResult.status === "fulfilled" ? previewResult.value : null
  if (options.isCurrent?.() === false) return
  if (
    (broadcast.liveVerse &&
      parseRef(broadcast.liveVerse.reference) &&
      !nextLive) ||
    (broadcast.previewVerse &&
      parseRef(broadcast.previewVerse.reference) &&
      !nextPreview)
  ) {
    options.onFailure?.()
  }
  const current = useBroadcastStore.getState()
  if (nextLive && current.liveVerse === broadcast.liveVerse) {
    useBroadcastStore.getState().setLiveVerse(nextLive)
  } else if (
    !nextLive &&
    broadcast.liveVerse &&
    current.liveVerse === broadcast.liveVerse
  ) {
    // Refetch failed but a verse is still live — re-emit to projector so it
    // doesn't silently keep showing the previous translation's payload.
    useBroadcastStore.getState().syncBroadcastOutput()
  }
  if (
    nextPreview &&
    useBroadcastStore.getState().previewVerse === broadcast.previewVerse
  ) {
    useBroadcastStore.getState().setPreviewVerse(nextPreview)
  }
}

export const broadcastActions = {
  setLiveVerse: (verse: VerseRenderData | null) =>
    useBroadcastStore.getState().setLiveVerse(verse),
  setLive: (live: boolean) => useBroadcastStore.getState().setLive(live),
  getActiveTheme: () => {
    const s = useBroadcastStore.getState()
    return s.themes.find((t) => t.id === s.activeThemeId) ?? s.themes[0]
  },
}
