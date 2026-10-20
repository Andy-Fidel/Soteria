import { useEffect, useRef, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useSettingsStore } from "@/stores/settings-store"
import {
  parseAudioTime,
  formatCutTime,
  validAudioCut,
  type SermonAudioInfo,
  type PreparedAudio,
  type AudioPublicationState,
} from "../(lib)/sermon-audio"
export function useSermonAudioEditor({
  sessionId,
  startedAtMs,
  disabled,
  onChange,
}: {
  sessionId: number
  startedAtMs?: number
  disabled: boolean
  onChange: (state: AudioPublicationState) => void
}) {
  const [mode, setMode] = useState<
    "loading" | "idle" | "suggesting" | "preparing"
  >("loading")
  const [info, setInfo] = useState<SermonAudioInfo | null>(null)
  const [cut, setCut] = useState({
    start: "00:00",
    end: "00:00",
    reviewed: false,
    reason: "",
  })
  const [error, setError] = useState("")
  const [included, setIncluded] = useState(false)
  const alive = useRef(false)
  useEffect(() => {
    alive.current = true
    void invoke<SermonAudioInfo>("get_sermon_audio", { sessionId })
      .then((value) => {
        if (!alive.current) return
        setInfo(value)
        setCut({
          start: formatCutTime(value.prepared?.startSeconds ?? 0),
          end: formatCutTime(
            value.prepared?.endSeconds ?? value.durationSeconds
          ),
          reviewed: false,
          reason: "",
        })
      })
      .catch((error) => {
        if (alive.current) setError(String(error))
      })
      .finally(() => {
        if (alive.current) setMode("idle")
      })
    return () => {
      alive.current = false
    }
  }, [sessionId])
  const busy = disabled || mode !== "idle"
  const start = parseAudioTime(cut.start),
    end = parseAudioTime(cut.end)
  const valid = info && validAudioCut(start, end, info.durationSeconds)
  const preparedMatches = Boolean(
    info?.prepared &&
    start !== null &&
    end !== null &&
    Math.abs(info.prepared.startSeconds - start) < 0.002 &&
    Math.abs(info.prepared.endSeconds - end) < 0.002
  )
  const change = (point: "start" | "end", value: string) => {
    setCut((cut) => ({ ...cut, [point]: value, reviewed: false }))
    setIncluded(false)
    onChange({ mode: "excluded" })
  }
  const suggest = async () => {
    setMode("suggesting")
    setError("")
    setIncluded(false)
    onChange({ mode: "busy" })
    try {
      const result = await invoke<{
        startSeconds: number
        endSeconds: number
        reason: string
      }>("suggest_sermon_audio", {
        sessionId,
        startedAtMs,
        apiKey: useSettingsStore.getState().deepseekApiKey ?? "",
      })
      if (alive.current)
        setCut({
          start: formatCutTime(result.startSeconds),
          end: formatCutTime(result.endSeconds),
          reviewed: false,
          reason: result.reason,
        })
    } catch (error) {
      if (alive.current) setError(String(error))
    } finally {
      if (alive.current) {
        setMode("idle")
        onChange({ mode: "excluded" })
      }
    }
  }
  const prepare = async () => {
    if (!valid || !cut.reviewed) return
    setMode("preparing")
    setError("")
    setIncluded(false)
    onChange({ mode: "busy" })
    try {
      const prepared = await invoke<PreparedAudio>("prepare_sermon_audio", {
        sessionId,
        startSeconds: start,
        endSeconds: end,
        reviewed: cut.reviewed,
      })
      if (alive.current)
        setInfo((info) => (info ? { ...info, prepared } : info))
    } catch (error) {
      if (alive.current) setError(String(error))
    } finally {
      if (alive.current) {
        setMode("idle")
        onChange({ mode: "excluded" })
      }
    }
  }
  return {
    state: {
      mode,
      info,
      cut,
      error,
      included,
      busy,
      start,
      end,
      valid,
      preparedMatches,
    },
    actions: { change, suggest, prepare, setCut, setIncluded },
  }
}
