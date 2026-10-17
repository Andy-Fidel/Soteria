import { beforeEach, describe, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { presentQueueItem } from "./use-remote-control"
import { useQueueStore } from "@/stores/queue-store"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import type { QueueItem } from "@/types"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(), emit: vi.fn().mockResolvedValue(undefined) }))
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }))

const item: Extract<QueueItem, { kind: "verse" }> = {
  id: "queued-kjv", kind: "verse", reference: "John 3:16", source: "manual", confidence: 1, added_at: 1,
  verse: { id: 1, translation_id: 1, book_number: 43, book_name: "John", book_abbreviation: "John", chapter: 3, verse: 16, text: "KJV words" },
}

beforeEach(() => {
  vi.mocked(invoke).mockReset()
  useQueueStore.setState({ items: [item], activeIndex: 0 })
  useBibleStore.setState({ activeTranslationId: 2, translations: [
    { id: 1, abbreviation: "KJV", title: "King James", language: "English", is_downloaded: true, is_copyrighted: false },
    { id: 2, abbreviation: "NIV", title: "New International", language: "English", is_downloaded: true, is_copyrighted: true },
  ] })
  useBroadcastStore.setState({ liveVerse: null, history: [] })
})

describe("remote queue presentation", () => {
  it("fetches and labels the queued translation after the picker changes", async () => {
    vi.mocked(invoke).mockImplementation(async (command, args) => command === "get_verse"
      ? { ...item.verse, translation_id: (args as { translationId: number }).translationId }
      : undefined)
    await presentQueueItem(0)
    expect(invoke).toHaveBeenCalledWith("get_verse", expect.objectContaining({ translationId: 1 }))
    expect(useBroadcastStore.getState().liveVerse?.reference).toBe("John 3:16 (KJV)")
    expect(useBroadcastStore.getState().liveVerse?.segments[0].text).toBe("KJV words")
  })
  it("keeps the queued chunk without fetching text in another translation", async () => {
    useQueueStore.setState({ items: [{ ...item, chunk: { groupId: "g", index: 0, total: 2, text: "First chunk" } }] })
    await presentQueueItem(0)
    expect(invoke).not.toHaveBeenCalledWith("get_verse", expect.anything())
    expect(useBroadcastStore.getState().liveVerse?.segments[0].text).toBe("First chunk")
  })
})
