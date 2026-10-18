import { invoke } from "@tauri-apps/api/core"
import { useSessionStore } from "@/stores/session-store"
import { useSettingsStore } from "@/stores/settings-store"
import type { SermonSession } from "@/types/session"

// A cheap trigger only. The server verifies meaning and exact transcript evidence.
const ANNOUNCEMENTS = [
  /\b(?:my|our|the|today['’]s)\s+(?:sermon|message|topic)(?:\s+(?:today|this\s+(?:morning|evening)))?\s+(?:is\s+)?(?:titled|entitled|called)\b/i,
  /\b(?:i['’]ve|i\s+have)\s+(?:titled|entitled|called)\s+(?:my|the|today['’]s)\s+(?:message|sermon)\b/i,
  /\b(?:title|subject|topic)\s+of\s+(?:my|our|the|today['’]s)\s+(?:sermon|message)\s+is\b/i,
  /\b(?:today|this\s+(?:morning|evening))\s+i(?:['’]m|\s+am)?\s+(?:want\s+to\s+|will\s+|am\s+going\s+to\s+)?(?:speak(?:ing)?|preach(?:ing)?|talk(?:ing)?)(?:\s+to\s+you)?\s+(?:on|about)\b/i,
  /\b(?:our|my)\s+(?:topic|subject)(?:\s+(?:today|this\s+(?:morning|evening)))?\s+is\b/i,
]

export function hasTitleAnnouncement(text: string): boolean {
  return ANNOUNCEMENTS.some((pattern) => pattern.test(text))
}

export function createLiveTitleDetector() {
  let state = {
    id: -1,
    parts: [] as string[],
    attempts: 0,
    busy: false,
    revision: 0,
  }
  return async (text: string): Promise<void> => {
    const session = useSessionStore.getState().activeSession
    if (
      !session ||
      session.status !== "live" ||
      session.titleSource !== "default"
    )
      return
    if (session.id !== state.id)
      state = {
        id: session.id,
        parts: [],
        attempts: 0,
        busy: false,
        revision: 0,
      }
    const currentState = state
    currentState.parts = [...currentState.parts.slice(-2), text.slice(-2000)]
    const revision = ++currentState.revision
    const context = currentState.parts.join(" ").slice(-2000)
    const key = useSettingsStore.getState().deepseekApiKey
    if (currentState.attempts >= 3 || !key || !hasTitleAnnouncement(context))
      return
    // Final speech segments can still split a sentence. Let adjoining words settle.
    await new Promise((resolve) => setTimeout(resolve, 600))
    if (state !== currentState || revision !== currentState.revision) return
    const run = async (): Promise<void> => {
      const active = useSessionStore.getState().activeSession
      if (
        state !== currentState ||
        currentState.busy ||
        currentState.attempts >= 3 ||
        active?.id !== session.id ||
        active.status !== "live" ||
        active.titleSource !== "default"
      )
        return
      const sentRevision = currentState.revision
      currentState.attempts++
      currentState.busy = true
      try {
        const updated = await invoke<SermonSession | null>(
          "detect_session_title",
          { id: session.id, apiKey: key }
        )
        const store = useSessionStore.getState()
        const current = store.activeSession
        if (
          !updated ||
          current?.id !== session.id ||
          current.status !== "live" ||
          current.titleSource !== "default" ||
          current.title !== session.title
        )
          return
        store.updateActiveSession({
          title: updated.title,
          titleSource: updated.titleSource,
        })
        useSessionStore.setState((value) => ({
          sessions: value.sessions.map((s) =>
            s.id === session.id
              ? { ...s, title: updated.title, titleSource: updated.titleSource }
              : s
          ),
          sessionsView:
            value.sessionsView?.id === session.id
              ? { ...value.sessionsView, title: updated.title }
              : value.sessionsView,
        }))
      } catch {
        // Naming is optional; network failures must not stop transcript capture.
        console.warn(
          "[live-title] Title check unavailable; keeping the current name"
        )
      } finally {
        currentState.busy = false
        if (currentState.revision !== sentRevision) await run()
      }
    }
    await run()
  }
}

export const detectLiveSermonTitle = createLiveTitleDetector()
