import { invoke } from "@tauri-apps/api/core"
import { useSessionStore } from "@/stores/session-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { clearPersistedQueue } from "@/stores/queue-store"
import { waitForTranscriptSaves } from "./transcription-events"
import { finalizeRecording } from "./finalize-recording"
import type { SermonSession } from "@/types"

const ending = new Map<number, Promise<SermonSession>>()

/** All End Session entry points stop their own recorder before closing the row. */
export function endSession(id: number): Promise<SermonSession> {
  const pending = ending.get(id)
  if (pending) return pending
  const operation = (async () => {
    if (useServicePlanStore.getState().plan?.planId === id) {
      useServicePlanStore.getState().cancelPendingAdvance()
      useServicePlanStore.setState({ presentedItemId: null })
    }
    await finalizeRecording(id)
    await waitForTranscriptSaves(id)
    if (useSessionStore.getState().activeSession?.id === id) {
      useTranscriptStore.setState({
        isTranscribing: false,
        currentPartial: "",
        connectionStatus: "disconnected",
      })
    }
    const updated = await invoke<SermonSession>("end_session", { id })
    if (useSessionStore.getState().activeSession?.id === id) {
      useSessionStore.getState().setActiveSession(updated)
      clearPersistedQueue()
    }
    useSessionStore.setState((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? updated : session
      ),
    }))
    return updated
  })().finally(() => ending.delete(id))
  ending.set(id, operation)
  return operation
}
