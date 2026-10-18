import { beforeEach, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { retranslateDetections } from "./retranslate-detections"
import { useDetectionStore } from "@/stores/detection-store"
import type { DetectionResult, Verse } from "@/types"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))
const detection: DetectionResult = {
  verse_ref: "John 3:16",
  verse_text: "KJV original",
  translation_id: 1,
  book_name: "John",
  book_number: 43,
  chapter: 3,
  verse: 16,
  confidence: 0.94,
  source: "direct",
  auto_queued: true,
  transcript_snippet: "Original sermon words",
}
const translated: Verse = {
  id: 2,
  translation_id: 2,
  book_number: 43,
  book_name: "John",
  book_abbreviation: "Jn",
  chapter: 3,
  verse: 16,
  text: "NIV translated",
}
beforeEach(() => {
  vi.resetAllMocks()
  useDetectionStore.setState({ detections: [detection] })
})
it("updates text and its translation while preserving original evidence", async () => {
  vi.mocked(invoke).mockResolvedValue(translated)
  await retranslateDetections(2)
  expect(useDetectionStore.getState().detections).toEqual([
    { ...detection, verse_text: "NIV translated", translation_id: 2 },
  ])
  await retranslateDetections(2)
  expect(invoke).toHaveBeenCalledOnce()
})
it.each([
  null,
  { ...translated, translation_id: 3 },
  { ...translated, chapter: 4 },
])(
  "retains original text and label on missing or mismatched results",
  async (result) => {
    const onFailure = vi.fn()
    vi.mocked(invoke).mockResolvedValue(result)
    await retranslateDetections(2, { onFailure })
    expect(useDetectionStore.getState().detections[0]).toBe(detection)
    expect(onFailure).toHaveBeenCalledOnce()
  }
)
it("retains original evidence when lookup rejects", async () => {
  vi.mocked(invoke).mockRejectedValue(new Error("DB unavailable"))
  await retranslateDetections(2)
  expect(useDetectionStore.getState().detections[0]).toBe(detection)
})
it("ignores results from an obsolete translation request", async () => {
  vi.mocked(invoke).mockResolvedValue(translated)
  await retranslateDetections(2, { isCurrent: () => false })
  expect(useDetectionStore.getState().detections[0]).toBe(detection)
})
it.each(["replaced", "cleared"])(
  "does not restore or overwrite a detection that was %s during lookup",
  async (change) => {
    vi.mocked(invoke).mockImplementation(async () => {
      useDetectionStore.setState({
        detections:
          change === "cleared"
            ? []
            : [
                {
                  ...detection,
                  confidence: 1,
                  transcript_snippet: "New evidence",
                },
              ],
      })
      return translated
    })
    await retranslateDetections(2)
    if (change === "cleared")
      expect(useDetectionStore.getState().detections).toEqual([])
    else
      expect(useDetectionStore.getState().detections[0]).toMatchObject({
        confidence: 1,
        transcript_snippet: "New evidence",
        verse_text: "KJV original",
        translation_id: 1,
      })
  }
)
