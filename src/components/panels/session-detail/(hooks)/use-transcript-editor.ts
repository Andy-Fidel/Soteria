import { useMemo, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import { invoke } from "@tauri-apps/api/core"
import type { SessionTranscriptSegment } from "@/types/session"
export function useTranscriptEditor(
  transcript: SessionTranscriptSegment[],
  setTranscript: Dispatch<SetStateAction<SessionTranscriptSegment[]>>
) {
  const [transcriptQuery, setTranscriptQuery] = useState("")
  const [transcriptEditMode, setTranscriptEditMode] = useState(false)
  const [editingSegmentId, setEditingSegmentId] = useState<number | null>(null)
  const [editingDraft, setEditingDraft] = useState("")
  // ── Transcript inline edit ────────────────────────────────────────
  const startEditSegment = (seg: SessionTranscriptSegment) => {
    setEditingSegmentId(seg.id)
    setEditingDraft(seg.text)
  }

  const cancelEditSegment = () => {
    setEditingSegmentId(null)
    setEditingDraft("")
  }

  const saveEditSegment = async () => {
    if (editingSegmentId == null) return
    const id = editingSegmentId
    const next = editingDraft
    try {
      await invoke("update_transcript_segment", { segmentId: id, text: next })
      setTranscript((prev) =>
        prev.map((s) => (s.id === id ? { ...s, text: next } : s))
      )
    } catch (e) {
      console.error("[session] update transcript segment failed:", e)
    }
    cancelEditSegment()
  }

  const deleteSegment = async (id: number) => {
    try {
      await invoke("delete_transcript_segment", { segmentId: id })
      setTranscript((prev) => prev.filter((s) => s.id !== id))
    } catch (e) {
      console.error("[session] delete transcript segment failed:", e)
    }
  }

  // ── Transcript search ─────────────────────────────────────────────
  const filteredTranscript = useMemo(() => {
    const q = transcriptQuery.trim().toLowerCase()
    if (!q) return transcript
    return transcript.filter((s) => s.text.toLowerCase().includes(q))
  }, [transcript, transcriptQuery])

  return {
    search: {
      query: transcriptQuery,
      setQuery: setTranscriptQuery,
      results: filteredTranscript,
    },
    mode: {
      editing: transcriptEditMode,
      toggle: () => {
        setTranscriptEditMode((value) => !value)
        cancelEditSegment()
      },
    },
    segment: {
      id: editingSegmentId,
      draft: editingDraft,
      setDraft: setEditingDraft,
      start: startEditSegment,
      cancel: cancelEditSegment,
      save: saveEditSegment,
      delete: deleteSegment,
    },
  }
}
