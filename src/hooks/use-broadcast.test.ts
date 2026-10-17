import { beforeEach, describe, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import type { Verse } from "@/types"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useSettingsStore } from "@/stores/settings-store"
import {
  deriveLiveVerse,
  queueVerseToRenderData,
  retranslateBroadcastVerses,
} from "./use-broadcast"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }))
const mockedInvoke = vi.mocked(invoke)

const sampleVerse: Verse = {
  id: 1,
  translation_id: 1,
  book_number: 1,
  book_name: "Genesis",
  book_abbreviation: "Gen",
  chapter: 1,
  verse: 2,
  text: "The earth was without form and void.",
}

beforeEach(() => {
  mockedInvoke.mockReset()
  useBibleStore.setState({
    books: [
      {
        id: 1,
        translation_id: 1,
        book_number: 1,
        name: "Genesis",
        abbreviation: "Gen",
        testament: "OT",
      },
    ],
  })
  useBroadcastStore.setState({
    liveVerse: {
      reference: "Genesis 1:1 (KJV)",
      segments: [{ text: "Old live", verseNumber: 1 }],
    },
    previewVerse: {
      reference: "Genesis 1:2 (KJV)",
      segments: [{ text: "Old preview", verseNumber: 2 }],
    },
    history: [],
  })
})

describe("deriveLiveVerse", () => {
  it("labels queued text with its own translation even when the picker has changed", () => {
    useBibleStore.setState({
      activeTranslationId: 2,
      translations: [
        {
          id: 1,
          abbreviation: "KJV",
          title: "King James",
          language: "English",
          is_copyrighted: false,
          is_downloaded: true,
        },
        {
          id: 2,
          abbreviation: "NIV",
          title: "New International",
          language: "English",
          is_copyrighted: true,
          is_downloaded: true,
        },
      ],
    })
    const render = queueVerseToRenderData({
      kind: "verse",
      id: "old-kjv",
      source: "manual",
      added_at: 1,
      verse: sampleVerse,
      reference: "Genesis 1:2",
      confidence: 1,
    })
    expect(render.reference).toBe("Genesis 1:2 (KJV)")
    expect(render.segments[0].text).toBe("The earth was without form and void.")
  })
  it("copies valid queue-item highlights into render data", () => {
    const render = queueVerseToRenderData({
      kind: "verse",
      id: "q-1",
      source: "manual",
      added_at: 1,
      verse: sampleVerse,
      reference: "Genesis 1:2",
      confidence: 1,
      highlights: [
        {
          segmentIndex: 0,
          start: 0,
          end: 3,
          color: "#FACC15",
          sourceText: "The",
        },
      ],
    })
    expect(render.highlights).toEqual([
      {
        segmentIndex: 0,
        start: 0,
        end: 3,
        color: "#FACC15",
        sourceText: "The",
      },
    ])
  })
  it("returns null when live output is off", () => {
    const result = deriveLiveVerse({
      isLive: false,
      selectedVerse: sampleVerse,
      translation: "NKJV",
    })

    expect(result).toBeNull()
  })

  it("returns verse render data when live output is on", () => {
    const result = deriveLiveVerse({
      isLive: true,
      selectedVerse: sampleVerse,
      translation: "NKJV",
    })

    expect(result).toEqual(
      expect.objectContaining({
        reference: "Genesis 1:2 (NKJV)",
      })
    )
  })
})

describe("retranslateBroadcastVerses", () => {
  it("keeps a long live passage split at the corresponding translated part", async () => {
    const first = Array.from({ length: 25 }, (_, i) => `first${i}`).join(" ")
    const second = Array.from({ length: 25 }, (_, i) => `second${i}`).join(" ")
    const third = Array.from({ length: 25 }, (_, i) => `third${i}`).join(" ")
    useSettingsStore.setState({
      autoSplitLongVerses: true,
      splitWordThreshold: 40,
    })
    useBroadcastStore.setState({
      liveVerse: {
        reference: "Genesis 1:2 (2/2) (KJV)",
        segments: [{ text: "Old second part", verseNumber: 2 }],
      },
      previewVerse: null,
    })
    mockedInvoke.mockResolvedValue({
      ...sampleVerse,
      translation_id: 2,
      text: `${first} ${second} ${third}`,
    })
    await retranslateBroadcastVerses(2, "NIV")
    expect(useBroadcastStore.getState().liveVerse).toMatchObject({
      reference: "Genesis 1:2 (2/3) (NIV)",
      segments: [{ text: second }],
    })
  })

  it("leaves a song preview unchanged without reporting a scripture translation failure", async () => {
    const song = {
      reference: "Amazing Grace — Verse 1",
      segments: [{ text: "Amazing grace", verseNumber: 1 }],
    }
    useBroadcastStore.setState({ liveVerse: null, previewVerse: song })
    const onFailure = vi.fn()
    await retranslateBroadcastVerses(2, "NIV", { onFailure })
    expect(useBroadcastStore.getState().previewVerse).toBe(song)
    expect(onFailure).not.toHaveBeenCalled()
  })
  it("commits a successful preview when the sibling live fetch rejects", async () => {
    const onFailure = vi.fn()
    mockedInvoke.mockImplementation(async (_command, args) => {
      const input = args as { verse: number }
      if (input.verse === 1) throw new Error("live unavailable")
      return {
        ...sampleVerse,
        id: 22,
        translation_id: 2,
        text: "Translated preview",
      }
    })

    await expect(
      retranslateBroadcastVerses(2, "NIV", { onFailure })
    ).resolves.toBeUndefined()

    expect(useBroadcastStore.getState().liveVerse).toMatchObject({
      segments: [{ text: "Old live" }],
    })
    expect(useBroadcastStore.getState().previewVerse).toMatchObject({
      reference: "Genesis 1:2 (NIV)",
      segments: [{ text: "Translated preview" }],
    })
    expect(onFailure).toHaveBeenCalledOnce()
  })
})
