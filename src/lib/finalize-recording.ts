import { invoke } from "@tauri-apps/api/core"

/** Native stop waits for this session's writer to flush before merging. */
export async function finalizeRecording(sessionId: number): Promise<void> {
  await invoke("stop_transcription", { sessionId })
  await invoke("finalize_session_audio", { sessionId })
}

/**
 * Lazily concatenate any leftover segments for a session (e.g. the app was
 * reloaded or crashed before End Session, so segments exist but no merged
 * `audio.mp3`). Safe no-op when already finalized. Returns the final audio
 * path if audio exists.
 */
export async function ensureSessionAudioMerged(
  sessionId: number,
): Promise<string | null> {
  try {
    return await invoke<string | null>("finalize_session_audio", { sessionId })
  } catch (e) {
    console.warn("[recording] lazy merge failed", e)
    return null
  }
}
