import { useEffect, useRef, useState } from "react"
import { MicOffIcon } from "lucide-react"
import { invoke } from "@tauri-apps/api/core"
import {
  useTranscriptStore,
  useAudioStore,
  useDetectionStore,
  useBibleStore,
  useSessionStore,
  useSettingsStore,
} from "@/stores"
import { useTauriEvent } from "@/hooks/use-tauri-event"
import { presentQueuedVerseLive } from "@/lib/queue-verse"
import { switchTranslation } from "@/lib/switch-translation"
import { handleSttConnection, handleTranscriptFinal, handleTranscriptPartial, type TranscriptPayload } from "@/lib/transcription-events"
import type { DetectionResult } from "@/types"
import { TranscriptContent } from "./transcript-panel/(components)/transcript-content"

const PROVIDER_LABEL: Record<string, string> = {
  deepgram: "Deepgram · nova-3",
  assemblyai: "AssemblyAI · universal-streaming",
  whisper: "Whisper · local",
}

export function TranscriptPanel() {
  const isTranscribing = useTranscriptStore((s) => s.isTranscribing)
  const sttProvider = useSettingsStore((s) => s.sttProvider)
  const recordAudio = useSettingsStore((s) => s.recordAudio)
  const [pauseState, setRecordingPaused] = useState(false)
  const recordingPaused = isTranscribing && pauseState
  // Auto-broadcast cooldown — prevents rapid flickering between verses.
  const lastAutoBroadcastAtRef = useRef(0)

  // Keep the pause toggle in sync with the backend (e.g. after a reload while
  // recording was paused).
  useEffect(() => {
    if (!isTranscribing) return
    let cancelled = false
    invoke<boolean>("get_recording_paused")
      .then((paused) => { if (!cancelled) setRecordingPaused(paused) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isTranscribing])

  const toggleRecordingPause = async () => {
    const next = !recordingPaused
    setRecordingPaused(next)
    try {
      await invoke("set_recording_paused", { paused: next })
    } catch {
      setRecordingPaused(!next) // revert on failure
    }
  }

  // Listen for Tauri events
  useTauriEvent<{ rms: number; peak: number }>("audio_level", (payload) => {
    useAudioStore.getState().setLevel(payload)
  })

  useTauriEvent("stt_connected", () => handleSttConnection("stt_connected"))
  useTauriEvent("stt_reconnecting", () => handleSttConnection("stt_reconnecting"))
  useTauriEvent("stt_disconnected", () => handleSttConnection("stt_disconnected"))
  useTauriEvent<string>("stt_error", (message) => handleSttConnection("stt_error", message))
  useTauriEvent<TranscriptPayload>("transcript_partial", handleTranscriptPartial)
  useTauriEvent<TranscriptPayload>("transcript_final", (payload) => {
    void handleTranscriptFinal(payload).catch((error) => {
      console.error("Failed to save session transcript", error)
    })
  })

  // Listen for voice translation commands: "read in NIV", "switch to ESV".
  // Honored only in auto broadcast mode — manual mode keeps the operator in
  // full control of translation selection.
  useTauriEvent<{ abbreviation: string; translation_id: number }>(
    "translation_command",
    (data) => {
      if (!useSettingsStore.getState().autoMode) return
      switchTranslation(data.translation_id)
    }
  )

  // Listen for detection results from the backend (batch replaces previous detections)
  useTauriEvent<DetectionResult[]>("verse_detections", (detections) => {
    useDetectionStore.getState().addDetections(detections)

    // Record detections to active session
    const activeSession = useSessionStore.getState().activeSession
    if (activeSession && activeSession.status === "live") {
      for (const d of detections) {
        invoke("add_session_detection", {
          request: {
            sessionId: activeSession.id,
            verseRef: d.verse_ref,
            verseText: d.verse_text || "",
            translation: useBibleStore.getState().translations
              .find(t => t.id === useBibleStore.getState().activeTranslationId)?.abbreviation ?? "KJV",
            confidence: d.confidence,
            source: d.source,
            transcriptSnippet: d.transcript_snippet || null,
          }
        }).catch(() => {})
      }
    }

    // History intentionally NOT populated from detections — it now reflects
    // only verses that actually went on screen (driven by `setLiveVerse` in
    // broadcast-store).

    // ── Auto-broadcast mode ──────────────────────────────────────
    const { autoMode, confidenceThreshold, cooldownMs } = useSettingsStore.getState()
    if (autoMode) {
      const now = Date.now()
      if (now - lastAutoBroadcastAtRef.current < cooldownMs) return // cooldown active

      // Find the best detection that meets the threshold
      const best = detections
        .filter((d) => d.confidence >= confidenceThreshold && d.book_number > 0)
        .sort((a, b) => b.confidence - a.confidence)[0]

      if (best) {
        lastAutoBroadcastAtRef.current = now
        const verse = {
          id: 0,
          translation_id: useBibleStore.getState().activeTranslationId,
          book_number: best.book_number,
          book_name: best.book_name,
          book_abbreviation: "",
          chapter: best.chapter,
          verse: best.verse,
          text: best.verse_text,
        }
        // Push directly to live screen — skip preview in auto mode
        presentQueuedVerseLive(verse, best.confidence)
      }
    }
  })

  // On mount (including webview reload), DON'T blindly stop transcription —
  // a reload keeps the Rust capture/recording thread alive, and stopping it
  // would drop the live recording segment and force a restart. Instead query
  // the backend: if it's still transcribing, re-attach (our event listeners
  // above are already registered, so transcript + detections keep flowing).
  useEffect(() => {
    invoke<boolean>("get_stt_status")
      .then((running) => {
        if (running) {
          useTranscriptStore.getState().setConnectionStatus("connected")
          useTranscriptStore.getState().setTranscribing(true)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div
      data-slot="transcript-panel"
      className="flex h-full min-w-0 flex-col overflow-hidden bg-card"
    >
      {/* Active STT provider label — helps operators verify they're on the
          expected model (especially when toggling between cloud and local). */}
      {isTranscribing && (
        <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-1 text-[0.625rem] tabular-nums text-muted-foreground/70">
          {/* Pause/resume audio recording without stopping transcription. */}
          {recordAudio ? (
            <button
              type="button"
              onClick={() => void toggleRecordingPause()}
              title={recordingPaused ? "Resume recording" : "Pause recording"}
              className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted/50"
            >
              {recordingPaused ? (
                <>
                  <MicOffIcon className="size-3 text-muted-foreground" />
                  <span>Paused</span>
                </>
              ) : (
                <>
                  <span className="size-1.5 animate-pulse rounded-full bg-red-500" aria-hidden />
                  <span className="text-red-500">REC</span>
                </>
              )}
            </button>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            <span>{PROVIDER_LABEL[sttProvider] ?? sttProvider}</span>
          </span>
        </div>
      )}
      <TranscriptContent isTranscribing={isTranscribing} />
    </div>
  )
}
