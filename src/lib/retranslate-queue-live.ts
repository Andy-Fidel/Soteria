import { invoke } from "@tauri-apps/api/core"
import type { QueueItem, Verse } from "@/types"
import { useQueueStore } from "@/stores/queue-store"
import { useSettingsStore } from "@/stores/settings-store"
import {
  retranslateQueueItems,
  scriptureLocationKey,
} from "./retranslate-queue"

interface RetranslateQueuedScripturesOptions {
  isCurrent?: () => boolean
  onFailure?: () => void
}

interface QueueSnapshot {
  items: QueueItem[]
  activeIndex: number | null
}

function snapshotQueue(): QueueSnapshot {
  const { items, activeIndex } = useQueueStore.getState()
  return { items, activeIndex }
}

function queueStillMatches(snapshot: QueueSnapshot): boolean {
  const current = useQueueStore.getState()
  return (
    current.activeIndex === snapshot.activeIndex &&
    current.items.length === snapshot.items.length &&
    current.items.every(
      (item, index) =>
        item.id === snapshot.items[index].id && item === snapshot.items[index]
    )
  )
}

async function fetchTranslations(
  items: QueueItem[],
  translationId: number
): Promise<{ translatedVerses: Record<string, Verse>; failed: boolean }> {
  const locations = new Map<string, Verse>()
  for (const item of items) {
    if (item.kind === "verse") {
      locations.set(scriptureLocationKey(item.verse), item.verse)
    }
  }

  const entries = await Promise.all(
    [...locations].map(async ([key, verse]) => {
      try {
        const translated = await invoke<Verse | null>("get_verse", {
          translationId,
          bookNumber: verse.book_number,
          chapter: verse.chapter,
          verse: verse.verse,
        })
        return translated ? ([key, translated] as const) : null
      } catch {
        return null
      }
    })
  )

  return {
    translatedVerses: Object.fromEntries(
      entries.filter(
        (entry): entry is readonly [string, Verse] => entry !== null
      )
    ),
    failed: entries.some((entry) => entry === null),
  }
}

export async function retranslateQueuedScriptures(
  translationId: number,
  options: RetranslateQueuedScripturesOptions = {}
): Promise<void> {
  let lastTranslatedVerses: Record<string, Verse> = {}
  let lastFetchFailed = false
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const snapshot = snapshotQueue()
    const settings = useSettingsStore.getState()
    const fetchResult = await fetchTranslations(snapshot.items, translationId)
    const { translatedVerses } = fetchResult
    lastTranslatedVerses = translatedVerses
    lastFetchFailed = fetchResult.failed

    if (options.isCurrent?.() === false) return
    if (!queueStillMatches(snapshot)) continue

    useQueueStore.getState().replaceQueueState(
      retranslateQueueItems({
        ...snapshot,
        translationId,
        translatedVerses,
        autoSplitLongVerses: settings.autoSplitLongVerses,
        splitWordThreshold: settings.splitWordThreshold,
      })
    )
    if (lastFetchFailed) options.onFailure?.()
    return
  }

  if (options.isCurrent?.() === false) return
  const latest = snapshotQueue()
  const settings = useSettingsStore.getState()
  useQueueStore.getState().replaceQueueState(
    retranslateQueueItems({
      ...latest,
      translationId,
      translatedVerses: lastTranslatedVerses,
      autoSplitLongVerses: settings.autoSplitLongVerses,
      splitWordThreshold: settings.splitWordThreshold,
    })
  )
  if (lastFetchFailed) options.onFailure?.()
}
