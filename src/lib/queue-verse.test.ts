import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Verse } from "@/types"
import { useBibleStore, useBroadcastStore, useQueueStore } from "@/stores"
import { useSettingsStore } from "@/stores/settings-store"
import { addOrFindQueuedVerse, presentQueuedVerseLive } from "./queue-verse"

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(true),
}))

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}))

const verse: Verse = {
  id: 3016,
  translation_id: 1,
  book_number: 43,
  book_name: "John",
  book_abbreviation: "Jn",
  chapter: 3,
  verse: 16,
  text: "For God so loved the world.",
}

describe("queue verse actions", () => {
  beforeEach(() => {
    useBibleStore.setState({
      translations: [
        {
          id: 1,
          title: "King James Version",
          abbreviation: "KJV",
          language: "English",
          is_copyrighted: false,
          is_downloaded: true,
        },
      ],
      activeTranslationId: 1,
      selectedVerse: null,
      pendingNavigation: null,
    })
    useQueueStore.setState({ items: [], activeIndex: null })
    useSettingsStore.setState({ autoSplitLongVerses: false })
    useBroadcastStore.setState({
      previewVerse: null,
      liveVerse: null,
      isLive: false,
    })
  })

  it("moves the Bible panel to the verse that goes live", () => {
    presentQueuedVerseLive(verse)

    expect(useBibleStore.getState().selectedVerse).toEqual(verse)
    expect(useBibleStore.getState().pendingNavigation).toEqual({
      bookNumber: 43,
      chapter: 3,
      verse: 16,
    })
    expect(useBroadcastStore.getState().liveVerse?.reference).toBe(
      "John 3:16 (KJV)"
    )
  })

  it("reuses a queued scripture when the requested translation differs", () => {
    const existing = addOrFindQueuedVerse(verse)
    const nivVerse: Verse = {
      ...verse,
      id: 43003016,
      translation_id: 2,
      text: "For God so loved the world that he gave his one and only Son.",
    }

    const found = addOrFindQueuedVerse(nivVerse)

    expect(found).toEqual(existing)
    expect(useQueueStore.getState().items).toHaveLength(1)
    expect(found.item?.kind === "verse" && found.item.verse).toEqual(verse)
  })

  it("returns the first part of a split scripture without appending a duplicate", () => {
    useSettingsStore.setState({
      autoSplitLongVerses: true,
      splitWordThreshold: 20,
    })
    const longKjvVerse: Verse = {
      ...verse,
      text:
        "For God so loved the world and gave his only begotten Son so that all who believe may live. " +
        "They will not perish but receive everlasting life through the gift of his grace and mercy. " +
        "This promise brings enduring hope to every person who trusts in him with a faithful heart.",
    }
    const nivVerse: Verse = {
      ...verse,
      id: 43003016,
      translation_id: 2,
      text: "For God so loved the world that he gave his one and only Son.",
    }

    const existing = addOrFindQueuedVerse(longKjvVerse)
    const queueLength = useQueueStore.getState().items.length
    const found = addOrFindQueuedVerse(nivVerse)

    expect(queueLength).toBeGreaterThan(1)
    expect(found).toEqual(existing)
    expect(found.index).toBe(0)
    expect(found.item?.kind === "verse" && found.item.chunk?.index).toBe(1)
    expect(useQueueStore.getState().items).toHaveLength(queueLength)
  })
})
