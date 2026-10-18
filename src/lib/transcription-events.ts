import { invoke } from "@tauri-apps/api/core"
import { useTranscriptStore } from "@/stores/transcript-store"
import { useSessionStore } from "@/stores/session-store"

import { detectLiveSermonTitle } from "./live-sermon-title"

const pendingSaves = new Map<number, Set<Promise<unknown>>>()

/** Stop has drained native events; wait for their queued database writes too. */
export async function waitForTranscriptSaves(sessionId: number): Promise<void> {
  await Promise.all(pendingSaves.get(sessionId) ?? [])
}

export type SttConnectionEvent =
  | "stt_connected"
  | "stt_reconnecting"
  | "stt_disconnected"
  | "stt_error"
export interface TranscriptPayload {
  text: string
  is_final: boolean
  confidence: number
}

export function handleSttConnection(event: SttConnectionEvent) {
  const store = useTranscriptStore.getState()
  if (event === "stt_connected") {
    store.setConnectionStatus("connected")
    store.setTranscribing(true)
  } else if (event === "stt_reconnecting") {
    store.setConnectionStatus("reconnecting")
  } else {
    store.setConnectionStatus(event === "stt_error" ? "error" : "disconnected")
    store.setTranscribing(false)
    store.setPartial("")
  }
}

export function handleTranscriptPartial(payload: TranscriptPayload) {
  useTranscriptStore.getState().setPartial(payload.text)
}

export async function handleTranscriptFinal(payload: TranscriptPayload) {
  const timestamp = Date.now()
  useTranscriptStore.getState().addSegment({
    id: crypto.randomUUID(),
    text: payload.text,
    is_final: true,
    confidence: payload.confidence,
    words: [],
    timestamp,
  })
  const session = useSessionStore.getState().activeSession
  if (session?.status !== "live") return
  const saving = invoke("add_session_transcript", {
    request: {
      sessionId: session.id,
      text: payload.text,
      isFinal: true,
      confidence: payload.confidence,
      timestampMs: timestamp,
      speakerLabel: null,
    },
  })
  const pending = pendingSaves.get(session.id) ?? new Set<Promise<unknown>>()
  pending.add(saving)
  pendingSaves.set(session.id, pending)
  try {
    await saving
  } finally {
    pending.delete(saving)
    if (pending.size === 0) pendingSaves.delete(session.id)
  }
  void detectLiveSermonTitle(payload.text)
}
