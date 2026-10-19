import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useSettingsStore } from "@/stores"
import type { SermonSummary } from "@/lib/summarize"
import {
  EMPTY_SHARING_DRAFT,
  parseSharingDraft,
  type SharingDraft,
} from "../(lib)/sharing-drafts"

export function useSharingDrafts(sessionId: number) {
  const [draft, setDraft] = useState<SharingDraft>(EMPTY_SHARING_DRAFT)
  const [saved, setSaved] = useState<SharingDraft>(EMPTY_SHARING_DRAFT)
  const [operation, setOperation] = useState<
    "loading" | "idle" | "generating" | "saving" | "load-error"
  >("loading")
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    invoke<SharingDraft | null>("get_sharing_draft", { sessionId })
      .then((value) => {
        if (cancelled) return
        setDraft(value ?? EMPTY_SHARING_DRAFT)
        setSaved(value ?? EMPTY_SHARING_DRAFT)
        setOperation("idle")
      })
      .catch((reason) => {
        if (cancelled) return
        setError(`Could not load drafts: ${String(reason)}`)
        setOperation("load-error")
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, retry])

  const generate = async (
    summary: SermonSummary,
    title: string,
    speaker?: string | null
  ) => {
    if (operation !== "idle") return
    const apiKey = useSettingsStore.getState().deepseekApiKey
    if (!apiKey) {
      setError("Add your DeepSeek API key in Settings → API Keys.")
      return
    }
    setOperation("generating")
    setError(null)
    try {
      const value = await invoke<SharingDraft>("generate_sharing_draft", {
        apiKey,
        summary: JSON.stringify(summary),
        title,
        speaker: speaker ?? null,
      })
      setDraft(parseSharingDraft(JSON.stringify(value)))
    } catch (reason) {
      setError(`Could not generate drafts: ${String(reason)}`)
    } finally {
      setOperation("idle")
    }
  }
  const save = async () => {
    if (operation !== "idle") return
    setOperation("saving")
    setError(null)
    try {
      await invoke("save_sharing_draft", { sessionId, draft })
      setSaved(draft)
    } catch (reason) {
      setError(`Could not save drafts: ${String(reason)}`)
    } finally {
      setOperation("idle")
    }
  }
  return {
    draft,
    operation,
    error,
    dirty: JSON.stringify(draft) !== JSON.stringify(saved),
    update: (field: keyof SharingDraft, value: string) =>
      setDraft((current) => ({ ...current, [field]: value })),
    generate,
    save,
    retry: () => {
      setError(null)
      setOperation("loading")
      setRetry((value) => value + 1)
    },
  }
}
