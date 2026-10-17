import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import type { Verse } from "@/types"
import { useBibleStore } from "@/stores/bible-store"
import { useSessionStore } from "@/stores/session-store"
import { retranslateBroadcastVerses } from "@/hooks/use-broadcast"
import { retranslateQueuedScriptures } from "./retranslate-queue-live"

interface TranslationRequest {
  id: number
  generation: number
  sessionId: number | null
}

let generation = 0
let worker: Promise<void> | null = null
let pending: TranslationRequest | null = null

async function retranslateSelectedVerse(
  translationId: number,
  isCurrent: () => boolean,
  onFailure: () => void
): Promise<void> {
  const selected = useBibleStore.getState().selectedVerse
  if (
    !selected ||
    selected.book_number <= 0 ||
    selected.chapter <= 0 ||
    selected.verse <= 0
  )
    return

  try {
    const translated = await invoke<Verse | null>("get_verse", {
      translationId,
      bookNumber: selected.book_number,
      chapter: selected.chapter,
      verse: selected.verse,
    })
    if (!translated) {
      if (isCurrent()) onFailure()
      return
    }
    if (!isCurrent()) return
    if (useBibleStore.getState().selectedVerse === selected) {
      useBibleStore.getState().selectVerse(translated)
    }
  } catch {
    if (isCurrent()) onFailure()
  }
}

function ensureWorker(): Promise<void> {
  if (worker) return worker

  worker = (async () => {
    while (pending) {
      const request = pending
      pending = null
      const isCurrent = () =>
        request.generation === generation &&
        request.sessionId ===
          (useSessionStore.getState().activeSession?.id ?? null)

      try {
        await invoke("set_active_translation", { translationId: request.id })
        if (!isCurrent()) continue

        const abbreviation =
          useBibleStore
            .getState()
            .translations.find((translation) => translation.id === request.id)
            ?.abbreviation ?? "Unknown"
        let failureReported = false
        const reportFailure = () => {
          if (!isCurrent() || failureReported) return
          failureReported = true
          toast.error(
            "Some scripture could not be translated. Original text was retained."
          )
        }
        await Promise.allSettled([
          retranslateQueuedScriptures(request.id, {
            isCurrent,
            onFailure: reportFailure,
          }),
          retranslateBroadcastVerses(request.id, abbreviation, {
            isCurrent,
            onFailure: reportFailure,
          }),
          retranslateSelectedVerse(request.id, isCurrent, reportFailure),
        ])
      } catch (error) {
        console.error("[switch-translation]", error)
      }
    }
  })().finally(() => {
    worker = null
    if (pending) void ensureWorker()
  })

  return worker
}

/** Updates selection immediately, then serializes and coalesces native/UI work. */
export function switchTranslation(id: number): Promise<void> {
  const state = useBibleStore.getState()
  if (state.activeTranslationId === id && worker === null)
    return Promise.resolve()

  const request = {
    id,
    generation: ++generation,
    sessionId: useSessionStore.getState().activeSession?.id ?? null,
  }
  state.setActiveTranslation(id)
  pending = request
  return ensureWorker()
}
