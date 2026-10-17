import { invoke } from "@tauri-apps/api/core"
import { useSessionStore } from "@/stores/session-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import type { SermonSession, SessionTranscriptSegment } from "@/types/session"

/** Load saved words before mounting the workspace and resuming audio capture. */
export async function restoreLiveSession(
  session: SermonSession
): Promise<boolean> {
  const previous = useSessionStore.getState().activeSession
  if (previous?.id === session.id) return true

  const saved = await invoke<SessionTranscriptSegment[]>(
    "get_session_transcript",
    {
      sessionId: session.id,
    }
  )
  if (useSessionStore.getState().activeSession !== previous) return false

  useSessionStore.getState().setActiveSession(session)
  useTranscriptStore.setState({
    segments: saved.map((segment) => ({
      id: `saved-${segment.id}`,
      text: segment.text,
      is_final: segment.isFinal,
      confidence: segment.confidence ?? 0,
      timestamp: segment.timestampMs,
      words: [],
    })),
    currentPartial: "",
  })
  return true
}
