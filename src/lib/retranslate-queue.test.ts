import { describe, expect, it } from "vitest"
import type { QueueItem, Verse } from "@/types"
import { retranslateQueueItems } from "./retranslate-queue"

const kjvVerse: Verse = {
  id: 3016,
  translation_id: 1,
  book_number: 43,
  book_name: "John",
  book_abbreviation: "Jn",
  chapter: 3,
  verse: 16,
  text: "For God so loved the world.",
}

const nivVerse: Verse = {
  ...kjvVerse,
  id: 93016,
  translation_id: 2,
  text: "For God so loved the world that he gave his one and only Son.",
}

function verseItem(verse: Verse): Extract<QueueItem, { kind: "verse" }> {
  return {
    kind: "verse",
    id: "verse-1",
    source: "manual",
    added_at: 123,
    verse,
    reference: "John 3:16",
    confidence: 0.9,
  }
}

function chunkedVerseItems(
  verse: Verse,
  count: number
): Extract<QueueItem, { kind: "verse" }>[] {
  return Array.from({ length: count }, (_, index) => ({
    ...verseItem(verse),
    id: `old-part-${index + 1}`,
    reference: `John 3:16 (${index + 1}/${count})`,
    chunk: {
      groupId: "scripture-group",
      index: index + 1,
      total: count,
      text: `Old part ${index + 1}`,
    },
  }))
}

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(
    " "
  )
}

describe("retranslateQueueItems", () => {
  it("clears highlight positions when the verse language changes", () => {
    const result = retranslateQueueItems({
      items: [
        {
          ...verseItem(kjvVerse),
          highlights: [
            {
              segmentIndex: 0,
              start: 0,
              end: 3,
              color: "#FACC15",
              sourceText: "For",
            },
          ],
        },
      ],
      activeIndex: 0,
      translationId: 2,
      translatedVerses: { "43:3:16": nivVerse },
      autoSplitLongVerses: false,
      splitWordThreshold: 40,
    })
    expect(
      result.items[0].kind === "verse" && result.items[0].highlights
    ).toBeUndefined()
  })
  it("replaces an ordinary verse without disturbing adjacent queue items", () => {
    const song: QueueItem = {
      kind: "song-stanza",
      id: "song-1",
      source: "manual",
      added_at: 124,
      songId: "song",
      stanzaId: "verse-1",
      expandedIndex: 0,
      reference: "Song — Verse 1",
      text: "Amazing grace",
    }
    const image: QueueItem = {
      kind: "image",
      id: "image-1",
      source: "manual",
      added_at: 125,
      url: "https://example.com/image.jpg",
      label: "Cross",
      provider: "local",
    }
    const items = [verseItem(kjvVerse), song, image]

    const result = retranslateQueueItems({
      items,
      activeIndex: 0,
      translationId: 2,
      translatedVerses: { "43:3:16": nivVerse },
      autoSplitLongVerses: false,
      splitWordThreshold: 40,
    })

    expect(result.items).toHaveLength(3)
    expect(result.items.map((item) => item.kind)).toEqual([
      "verse",
      "song-stanza",
      "image",
    ])
    expect(result.items[0]).toMatchObject({
      id: "verse-1",
      verse: nivVerse,
      reference: "John 3:16",
    })
    expect(result.items[1]).toBe(song)
    expect(result.items[2]).toBe(image)
    expect(result.activeIndex).toBe(0)
  })

  it("maps the active second of two old parts to the proportional part of three replacements", () => {
    const translatedVerse = { ...nivVerse, text: words(70) }

    const result = retranslateQueueItems({
      items: chunkedVerseItems(kjvVerse, 2),
      activeIndex: 1,
      translationId: 2,
      translatedVerses: { "43:3:16": translatedVerse },
      autoSplitLongVerses: true,
      splitWordThreshold: 40,
    })

    expect(result.items).toHaveLength(3)
    expect(
      result.items.map((item) => item.kind === "verse" && item.chunk?.index)
    ).toEqual([1, 2, 3])
    expect(result.items[0]).toMatchObject({
      id: "old-part-1",
      source: "manual",
      confidence: 0.9,
      added_at: 123,
      chunk: { groupId: "scripture-group", index: 1, total: 3 },
    })
    expect(result.items[1].id).not.toBe("old-part-2")
    expect(result.items[2].id).not.toBe("old-part-2")
    expect(result.activeIndex).toBe(1)
  })

  it("clamps the active third of three old parts to a single replacement", () => {
    const result = retranslateQueueItems({
      items: chunkedVerseItems(kjvVerse, 3),
      activeIndex: 2,
      translationId: 2,
      translatedVerses: { "43:3:16": nivVerse },
      autoSplitLongVerses: true,
      splitWordThreshold: 40,
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: "old-part-1",
      verse: nivVerse,
      reference: "John 3:16",
    })
    expect(
      result.items[0].kind === "verse" && result.items[0].chunk
    ).toBeUndefined()
    expect(result.activeIndex).toBe(0)
  })

  it("preserves a logical group and its active position when translation is missing", () => {
    const oldGroup = chunkedVerseItems(kjvVerse, 2)
    const before = JSON.stringify(oldGroup)

    const result = retranslateQueueItems({
      items: oldGroup,
      activeIndex: 1,
      translationId: 2,
      translatedVerses: {},
      autoSplitLongVerses: true,
      splitWordThreshold: 40,
    })

    expect(JSON.stringify(result.items)).toBe(before)
    expect(result.items[0]).toBe(oldGroup[0])
    expect(result.items[1]).toBe(oldGroup[1])
    expect(result.activeIndex).toBe(1)
  })
})
