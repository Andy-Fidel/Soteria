import { describe, expect, it } from "vitest"
import { queueItemTranslation, verseTranslation } from "./queue-translation"
import type { QueueItem, Translation, Verse } from "@/types"

const translations: Translation[] = [
  {
    id: 1,
    abbreviation: "KJV",
    title: "King James Version",
    language: "English",
    is_copyrighted: false,
    is_downloaded: true,
  },
  {
    id: 2,
    abbreviation: "NIV",
    title: "New International Version",
    language: "English",
    is_copyrighted: true,
    is_downloaded: true,
  },
]

function verseItem(
  translationId: number
): Extract<QueueItem, { kind: "verse" }> {
  const verse: Verse = {
    id: 1,
    translation_id: translationId,
    book_number: 43,
    book_name: "John",
    book_abbreviation: "John",
    chapter: 3,
    verse: 16,
    text: "For God so loved the world",
  }

  return {
    kind: "verse",
    id: "verse-1",
    verse,
    reference: "John 3:16",
    confidence: 1,
    source: "manual",
    added_at: 1,
  }
}

describe("queueItemTranslation", () => {
  it("resolves a scripture label from the queued verse translation", () => {
    expect(queueItemTranslation(verseItem(2), translations)).toBe("NIV")
  })

  it("uses the verse payload translation instead of the globally active translation", () => {
    expect(verseTranslation(verseItem(1).verse, translations)).toBe("KJV")
  })

  it("returns null when the queued verse translation is not loaded", () => {
    expect(queueItemTranslation(verseItem(99), translations)).toBeNull()
  })

  it.each<QueueItem>([
    {
      kind: "song-stanza",
      id: "song-1",
      songId: "song",
      stanzaId: "verse-1",
      expandedIndex: 0,
      reference: "Amazing Grace · Verse 1",
      text: "Amazing grace",
      source: "manual",
      added_at: 1,
    },
    {
      kind: "image",
      id: "image-1",
      url: "image.jpg",
      label: "Background",
      provider: "local",
      source: "manual",
      added_at: 1,
    },
  ])("returns null for $kind items", (item) => {
    expect(queueItemTranslation(item, translations)).toBeNull()
  })
})
