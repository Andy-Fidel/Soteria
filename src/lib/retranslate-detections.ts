import { invoke } from "@tauri-apps/api/core"
import { useDetectionStore } from "@/stores/detection-store"
import type { DetectionResult, Verse } from "@/types"

interface Options {
  isCurrent?: () => boolean
  onFailure?: () => void
}

/** Refresh display text without changing detection evidence or recency. */
export async function retranslateDetections(
  translationId: number,
  options: Options = {}
) {
  const snapshot = useDetectionStore
    .getState()
    .detections.filter(
      (detection) =>
        detection.translation_id !== translationId || !detection.verse_text
    )
  if (snapshot.length === 0) return
  const replacements = new Map<DetectionResult, DetectionResult>()
  let failed = false
  await Promise.all(
    snapshot.map(async (detection) => {
      if (
        detection.book_number <= 0 ||
        detection.chapter <= 0 ||
        detection.verse <= 0
      )
        return
      try {
        const verse = await invoke<Verse | null>("get_verse", {
          translationId,
          bookNumber: detection.book_number,
          chapter: detection.chapter,
          verse: detection.verse,
        })
        if (
          !verse?.text ||
          verse.translation_id !== translationId ||
          verse.book_number !== detection.book_number ||
          verse.chapter !== detection.chapter ||
          verse.verse !== detection.verse
        ) {
          failed = true
          return
        }
        replacements.set(detection, {
          ...detection,
          verse_text: verse.text,
          translation_id: verse.translation_id,
        })
      } catch {
        failed = true
      }
    })
  )
  if (options.isCurrent?.() === false) return
  if (replacements.size > 0) {
    useDetectionStore.setState((state) => {
      // Identity guards preserve newly arrived detections and cleared sessions.
      if (!state.detections.some((detection) => replacements.has(detection)))
        return state
      return {
        detections: state.detections.map(
          (detection) => replacements.get(detection) ?? detection
        ),
      }
    })
  }
  if (failed) options.onFailure?.()
}
