import { beforeEach, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import type { Book, Verse } from "@/types"
import { useBibleStore } from "@/stores/bible-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useQueueStore } from "@/stores/queue-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useSessionStore } from "@/stores/session-store"
import { switchTranslation } from "./switch-translation"

const toastError = vi.hoisted(() => vi.fn())

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }))
vi.mock("sonner", () => ({ toast: { error: toastError } }))

const mockedInvoke = vi.mocked(invoke)
const kjv: Verse = {
  id: 1,
  translation_id: 1,
  book_number: 43,
  book_name: "John",
  book_abbreviation: "Jn",
  chapter: 3,
  verse: 16,
  text: "KJV text",
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(() => {
  useSessionStore.setState({ activeSession: null })
  mockedInvoke.mockReset()
  toastError.mockReset()
  useBibleStore.setState({
    activeTranslationId: 1,
    translations: [
      {
        id: 1,
        title: "King James",
        abbreviation: "KJV",
        language: "English",
        is_copyrighted: false,
        is_downloaded: true,
      },
      {
        id: 2,
        title: "New International",
        abbreviation: "NIV",
        language: "English",
        is_copyrighted: true,
        is_downloaded: true,
      },
      {
        id: 3,
        title: "English Standard",
        abbreviation: "ESV",
        language: "English",
        is_copyrighted: true,
        is_downloaded: true,
      },
    ],
    books: [
      {
        id: 43,
        translation_id: 1,
        book_number: 43,
        name: "John",
        abbreviation: "Jn",
        testament: "NT",
      },
    ],
    selectedVerse: kjv,
  })
  useQueueStore.setState({
    items: [
      {
        kind: "verse",
        id: "q",
        source: "manual",
        added_at: 1,
        verse: kjv,
        confidence: 1,
        reference: "John 3:16",
      },
    ],
    activeIndex: 0,
  })
  useSettingsStore.setState({
    autoSplitLongVerses: false,
    splitWordThreshold: 40,
  })
  useBroadcastStore.setState({
    previewVerse: {
      reference: "John 3:16 (KJV)",
      segments: [{ text: "KJV preview", verseNumber: 16 }],
    },
    liveVerse: {
      reference: "John 3:16 (KJV)",
      segments: [{ text: "KJV live", verseNumber: 16 }],
    },
    history: [],
  })
})

it("coalesces a rapid switch and lets only the current generation update every scripture surface", async () => {
  const nivRequests: Array<ReturnType<typeof deferred<Verse | null>>> = []
  mockedInvoke.mockImplementation(async (command, args) => {
    if (command === "set_active_translation") return undefined
    if (command !== "get_verse") return undefined
    const translationId = (args as { translationId: number }).translationId
    if (translationId === 2) {
      const request = deferred<Verse | null>()
      nivRequests.push(request)
      return request.promise
    }
    return { ...kjv, id: 3, translation_id: 3, text: "ESV text" }
  })

  const nivWork = switchTranslation(2)
  await vi.waitFor(() => expect(nivRequests.length).toBeGreaterThan(0))
  const esvWork = switchTranslation(3)
  nivRequests.forEach((request) =>
    request.resolve({ ...kjv, id: 2, translation_id: 2, text: "NIV text" })
  )
  await Promise.all([nivWork, esvWork])

  expect(useBibleStore.getState()).toMatchObject({
    activeTranslationId: 3,
    selectedVerse: { translation_id: 3, text: "ESV text" },
  })
  expect(useQueueStore.getState().items[0]).toMatchObject({
    verse: { translation_id: 3, text: "ESV text" },
  })
  expect(useBroadcastStore.getState().previewVerse).toMatchObject({
    reference: "John 3:16 (ESV)",
    segments: [{ text: "ESV text" }],
  })
  expect(useBroadcastStore.getState().liveVerse).toMatchObject({
    reference: "John 3:16 (ESV)",
    segments: [{ text: "ESV text" }],
  })
  const persisted = mockedInvoke.mock.calls.filter(
    ([command]) => command === "set_active_translation"
  )
  expect(persisted.at(-1)?.[1]).toEqual({ translationId: 3 })
})

it("preserves operator preview and live changes made while translation is fetching", async () => {
  const request = deferred<Verse | null>()
  mockedInvoke.mockImplementation(async (command) =>
    command === "get_verse" ? request.promise : undefined
  )

  const work = switchTranslation(3)
  await vi.waitFor(() =>
    expect(
      mockedInvoke.mock.calls.some(([command]) => command === "get_verse")
    ).toBe(true)
  )
  const operatorPreview = {
    reference: "Psalm 1:1 (KJV)",
    segments: [{ text: "Operator preview", verseNumber: 1 }],
  }
  useBroadcastStore.getState().setPreviewVerse(operatorPreview)
  useBroadcastStore.getState().setLiveVerse(null)
  request.resolve({ ...kjv, id: 3, translation_id: 3, text: "ESV text" })
  await work

  expect(useBroadcastStore.getState().previewVerse).toBe(operatorPreview)
  expect(useBroadcastStore.getState().liveVerse).toBeNull()
})

it("preserves a same-location selected verse replacement made while translation is fetching", async () => {
  const request = deferred<Verse | null>()
  mockedInvoke.mockImplementation(async (command) =>
    command === "get_verse" ? request.promise : undefined
  )

  const work = switchTranslation(3)
  await vi.waitFor(() =>
    expect(
      mockedInvoke.mock.calls.some(([command]) => command === "get_verse")
    ).toBe(true)
  )
  const operatorSelection = { ...kjv, id: 77, text: "Operator selection" }
  useBibleStore.getState().selectVerse(operatorSelection)
  request.resolve({ ...kjv, id: 3, translation_id: 3, text: "ESV text" })
  await work

  expect(useBibleStore.getState().selectedVerse).toBe(operatorSelection)
})

it("does not commit stale book metadata after a rapid switch", async () => {
  const nivBooks = deferred<Book[]>()
  const committedBookTranslations: number[][] = []
  useBibleStore.setState({ books: [] })
  const unsubscribe = useBibleStore.subscribe((state, previous) => {
    if (state.books !== previous.books) {
      committedBookTranslations.push(
        state.books.map((book) => book.translation_id)
      )
    }
  })
  mockedInvoke.mockImplementation(async (command, args) => {
    const translationId = (args as { translationId?: number })?.translationId
    if (command === "set_active_translation") return undefined
    if (command === "list_books") {
      if (translationId === 2) return nivBooks.promise
      return [
        {
          id: 43,
          translation_id: 3,
          book_number: 43,
          name: "John",
          abbreviation: "Jn",
          testament: "NT",
        },
      ]
    }
    if (command === "get_verse") {
      return { ...kjv, id: translationId, translation_id: translationId ?? 0 }
    }
    return undefined
  })

  const nivWork = switchTranslation(2)
  await vi.waitFor(() =>
    expect(
      mockedInvoke.mock.calls.some(
        ([command, args]) =>
          command === "list_books" &&
          (args as { translationId: number }).translationId === 2
      )
    ).toBe(true)
  )
  const esvWork = switchTranslation(3)
  nivBooks.resolve([
    {
      id: 43,
      translation_id: 2,
      book_number: 43,
      name: "NIV John",
      abbreviation: "NIV-Jn",
      testament: "NT",
    },
  ])
  await Promise.all([nivWork, esvWork])
  unsubscribe()

  expect(committedBookTranslations).not.toContainEqual([2])
  expect(useBibleStore.getState().books).toMatchObject([
    { translation_id: 3, name: "John" },
  ])
})

it("reports current translation failures once while retaining failed scripture", async () => {
  mockedInvoke.mockImplementation(async (command) => {
    if (command === "get_verse") return null
    return undefined
  })

  await switchTranslation(3)

  expect(useQueueStore.getState().items[0]).toMatchObject({ verse: kjv })
  expect(useBibleStore.getState().selectedVerse).toBe(kjv)
  expect(toastError).toHaveBeenCalledOnce()
  expect(toastError).toHaveBeenCalledWith(
    "Some scripture could not be translated. Original text was retained."
  )
})

it("does not apply an old translation request to a newly activated session", async () => {
  const request = deferred<Verse | null>()
  mockedInvoke.mockImplementation(async (command) =>
    command === "get_verse" ? request.promise : undefined
  )
  const work = switchTranslation(2)
  await vi.waitFor(() =>
    expect(
      mockedInvoke.mock.calls.some(([command]) => command === "get_verse")
    ).toBe(true)
  )
  useSessionStore.getState().setActiveSession({
    id: 8,
    title: "New service",
    speaker: null,
    date: "2026-10-17",
    seriesName: null,
    tags: [],
    startedAt: null,
    endedAt: null,
    status: "planned",
    plannedScriptures: [],
    summary: null,
    audioPath: null,
    createdAt: "2026-10-17",
    updatedAt: "2026-10-17",
  })
  const newSelection = { ...kjv, id: 88, text: "New session selection" }
  useBibleStore.getState().selectVerse(newSelection)
  useQueueStore.getState().addItem({
    kind: "verse",
    id: "new-session-verse",
    source: "manual",
    added_at: 2,
    verse: newSelection,
    reference: "John 3:16",
    confidence: 1,
  })
  useBroadcastStore.getState().setPreviewVerse(null)
  request.resolve({ ...kjv, translation_id: 2, text: "Old request result" })
  await work
  expect(useQueueStore.getState().items[0]).toMatchObject({
    verse: newSelection,
  })
  expect(useBibleStore.getState().selectedVerse).toBe(newSelection)
  expect(useBroadcastStore.getState().previewVerse).toBeNull()
})
