import { beforeEach, describe, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import type { QueueItem, Verse } from "@/types"
import { useQueueStore } from "@/stores/queue-store"
import { useSettingsStore } from "@/stores/settings-store"
import { retranslateQueuedScriptures } from "./retranslate-queue-live"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))
vi.mock("@tauri-apps/api/event", () => ({ emit: vi.fn() }))
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }))

const mockedInvoke = vi.mocked(invoke)

const john: Verse = {
  id: 1,
  translation_id: 1,
  book_number: 43,
  book_name: "John",
  book_abbreviation: "Jn",
  chapter: 3,
  verse: 16,
  text: "Old John",
}
const genesis: Verse = {
  id: 2,
  translation_id: 1,
  book_number: 1,
  book_name: "Genesis",
  book_abbreviation: "Ge",
  chapter: 1,
  verse: 1,
  text: "Old Genesis",
}

function verseItem(
  id: string,
  verse: Verse,
  chunk?: { index: number; total: number }
): QueueItem {
  return {
    kind: "verse",
    confidence: 1,
    id,
    source: "manual",
    added_at: 1,
    verse,
    reference: chunk
      ? `${verse.book_name} ${verse.chapter}:${verse.verse} (${chunk.index}/${chunk.total})`
      : `${verse.book_name} ${verse.chapter}:${verse.verse}`,
    chunk: chunk
      ? {
          groupId: "john-group",
          index: chunk.index,
          total: chunk.total,
          text: `part ${chunk.index}`,
        }
      : undefined,
  }
}

const song: QueueItem = {
  kind: "song-stanza",
  id: "song",
  source: "manual",
  added_at: 2,
  songId: "s",
  stanzaId: "v",
  expandedIndex: 0,
  reference: "Song",
  text: "Sing",
}
const image: QueueItem = {
  kind: "image",
  id: "image",
  source: "manual",
  added_at: 3,
  url: "image.jpg",
  label: "Image",
  provider: "local",
}

function translated(verse: Verse, translationId = 2): Verse {
  return {
    ...verse,
    id: verse.id + 100,
    translation_id: translationId,
    text: `New ${verse.book_name}`,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  mockedInvoke.mockReset()
  useQueueStore.setState({ items: [], activeIndex: null })
  useSettingsStore.setState({
    autoSplitLongVerses: false,
    splitWordThreshold: 40,
  })
})

describe("retranslateQueuedScriptures", () => {
  it("fetches each logical location once and atomically preserves non-scripture items", async () => {
    const first = verseItem("john-1", john, { index: 1, total: 2 })
    const second = verseItem("john-2", john, { index: 2, total: 2 })
    useQueueStore.setState({
      items: [first, second, song, verseItem("genesis", genesis), image],
      activeIndex: 1,
    })
    mockedInvoke.mockImplementation(async (_command, args) => {
      const input = args as { bookNumber: number }
      return input.bookNumber === 43 ? translated(john) : translated(genesis)
    })

    await retranslateQueuedScriptures(2)

    const getVerseCalls = mockedInvoke.mock.calls.filter(
      ([command]) => command === "get_verse"
    )
    expect(getVerseCalls).toHaveLength(2)
    expect(getVerseCalls.map(([, args]) => args)).toEqual(
      expect.arrayContaining([
        { translationId: 2, bookNumber: 43, chapter: 3, verse: 16 },
        { translationId: 2, bookNumber: 1, chapter: 1, verse: 1 },
      ])
    )
    const queue = useQueueStore.getState()
    expect(
      queue.items
        .filter((item) => item.kind === "verse")
        .map((item) => item.verse.translation_id)
    ).toEqual([2, 2])
    expect(queue.items.find((item) => item.id === "song")).toBe(song)
    expect(queue.items.find((item) => item.id === "image")).toBe(image)
    expect(queue.activeIndex).toBe(0)
  })

  it("leaves failed scripture groups and non-scripture items unchanged", async () => {
    const johnItem = verseItem("john", john)
    const genesisItem = verseItem("genesis", genesis)
    useQueueStore.setState({
      items: [johnItem, song, genesisItem, image],
      activeIndex: 2,
    })
    mockedInvoke.mockImplementation(async (_command, args) => {
      const input = args as { bookNumber: number }
      if (input.bookNumber === 1) throw new Error("missing")
      return translated(john)
    })

    await expect(retranslateQueuedScriptures(2)).resolves.toBeUndefined()

    const items = useQueueStore.getState().items
    expect(items[0].kind === "verse" && items[0].verse).toEqual(
      translated(john)
    )
    expect(items[1]).toBe(song)
    expect(items[2]).toBe(genesisItem)
    expect(items[3]).toBe(image)
  })

  it("retries from the latest snapshot when the operator edits the queue", async () => {
    const firstFetch = deferred<Verse | null>()
    useQueueStore.setState({ items: [verseItem("john", john)], activeIndex: 0 })
    mockedInvoke
      .mockImplementationOnce(() => firstFetch.promise)
      .mockImplementation(async (_command, args) => {
        const input = args as { bookNumber: number }
        return input.bookNumber === 43 ? translated(john) : translated(genesis)
      })

    const work = retranslateQueuedScriptures(2)
    const operatorItem = verseItem("genesis", genesis)
    useQueueStore.getState().addItem(operatorItem)
    firstFetch.resolve(translated(john))
    await work

    expect(mockedInvoke).toHaveBeenCalledTimes(3)
    expect(useQueueStore.getState().items.map((item) => item.id)).toEqual([
      "john",
      "genesis",
    ])
    expect(
      useQueueStore
        .getState()
        .items.every(
          (item) => item.kind !== "verse" || item.verse.translation_id === 2
        )
    ).toBe(true)
  })

  it("merges fetched translations after a second conflict without overwriting operator edits", async () => {
    const firstFetch = deferred<Verse | null>()
    const retryFetch = deferred<Verse | null>()
    useQueueStore.setState({
      items: [verseItem("john", john), song],
      activeIndex: 0,
    })
    mockedInvoke
      .mockImplementationOnce(() => firstFetch.promise)
      .mockImplementationOnce(() => retryFetch.promise)

    const work = retranslateQueuedScriptures(2)
    useQueueStore.getState().setActive(1)
    firstFetch.resolve(translated(john))
    await vi.waitFor(() => expect(mockedInvoke).toHaveBeenCalledTimes(2))
    const operatorImage = { ...image, id: "operator-image" }
    useQueueStore.getState().addItem(operatorImage)
    useQueueStore.getState().reorderItems(2, 0)
    useQueueStore.getState().setActive(1)
    retryFetch.resolve(translated(john))
    await work

    expect(useQueueStore.getState().items.map((item) => item.id)).toEqual([
      "operator-image",
      "john",
      "song",
    ])
    expect(useQueueStore.getState().items[1]).toMatchObject({
      verse: translated(john),
    })
    expect(useQueueStore.getState().activeIndex).toBe(1)
  })

  it("does not commit when its generation is stale", async () => {
    const fetch = deferred<Verse | null>()
    const old = verseItem("john", john)
    useQueueStore.setState({ items: [old], activeIndex: 0 })
    mockedInvoke.mockReturnValue(fetch.promise)
    let current = true

    const work = retranslateQueuedScriptures(2, { isCurrent: () => current })
    current = false
    fetch.resolve(translated(john))
    await work

    expect(useQueueStore.getState().items[0]).toBe(old)
  })
})
