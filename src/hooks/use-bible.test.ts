import { beforeEach, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { bibleActions } from "./use-bible"
import { useBibleStore } from "@/stores/bible-store"
import type { Verse } from "@/types"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))

const genesis: Verse = {
  id: 1, translation_id: 1, book_number: 1, book_name: "Genesis",
  book_abbreviation: "Gen", chapter: 3, verse: 1, text: "Genesis text",
}
const john: Verse = {
  ...genesis, id: 2, book_number: 43, book_name: "John",
  book_abbreviation: "Jn", verse: 12, text: "John text",
}

beforeEach(() => {
  vi.resetAllMocks()
  useBibleStore.setState({ currentChapter: [], activeTranslationId: 1 })
})

it("keeps the latest chapter when an earlier request completes late", async () => {
  let finishEarlier!: (verses: Verse[]) => void
  vi.mocked(invoke)
    .mockReturnValueOnce(new Promise<Verse[]>((resolve) => { finishEarlier = resolve }))
    .mockResolvedValueOnce([genesis])
  const earlier = bibleActions.loadChapter(43, 3)
  await bibleActions.loadChapter(1, 3)
  finishEarlier([john])
  await earlier
  expect(useBibleStore.getState().currentChapter).toEqual([genesis])
})

it("loads the requested book, chapter and translation", async () => {
  vi.mocked(invoke).mockResolvedValueOnce([john])
  expect(await bibleActions.loadChapter(43, 3, 2)).toEqual([john])
  expect(invoke).toHaveBeenCalledWith("get_chapter", { translationId: 2, bookNumber: 43, chapter: 3 })
  expect(useBibleStore.getState().currentChapter).toEqual([john])
})
