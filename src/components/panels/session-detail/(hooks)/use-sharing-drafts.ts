import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useSettingsStore } from "@/stores"
import type { SermonSummary } from "@/lib/summarize"
import { attachSermonLink, type SessionPublication } from "../(lib)/publication"
import {
  expandSessionSlides,
  type SavedSessionSlide,
} from "../(lib)/session-slides"
import { transcriptArtwork } from "../(lib)/transcript-presentation"
import { renderSlideJpeg } from "../(lib)/slide-download"
import {
  EMPTY_SHARING_DRAFT,
  parseSharingDraft,
  type SharingDraft,
  smsMetrics,
} from "../(lib)/sharing-drafts"

export function useSharingDrafts(sessionId: number) {
  const [draft, setDraft] = useState<SharingDraft>(EMPTY_SHARING_DRAFT)
  const [saved, setSaved] = useState<SharingDraft>(EMPTY_SHARING_DRAFT)
  const [publication, setPublication] = useState<SessionPublication | null>(
    null
  )
  const [operation, setOperation] = useState<
    "loading" | "idle" | "generating" | "saving" | "publishing" | "load-error"
  >("loading")
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      invoke<SharingDraft | null>("get_sharing_draft", { sessionId }),
      invoke<SessionPublication | null>("get_session_publication", {
        sessionId,
      }),
    ])
      .then(([value, published]) => {
        if (cancelled) return
        setDraft(value ?? EMPTY_SHARING_DRAFT)
        setSaved(value ?? EMPTY_SHARING_DRAFT)
        setPublication(published)
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
      const next = parseSharingDraft(JSON.stringify(value))
      if (publication?.url)
        next.sms = attachSermonLink(next.sms, publication.url)
      setDraft(next)
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
  const publish = async (title: string, speaker?: string | null) => {
    if (operation !== "idle") return
    setOperation("publishing")
    setError(null)
    let published: SessionPublication
    try {
      await invoke("save_sharing_draft", { sessionId, draft })
      setSaved(draft)
      const rows = await invoke<SavedSessionSlide[]>("get_session_slides", {
        sessionId,
      })
      const artwork = transcriptArtwork(
        expandSessionSlides(rows),
        title,
        speaker ?? null
      )
      const bytes = await renderSlideJpeg(artwork)
      const encoded = btoa(
        Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")
      )
      published = await invoke<SessionPublication>("publish_session_recap", {
        sessionId,
        artwork: `data:image/jpeg;base64,${encoded}`,
      })
      setPublication(published)
    } catch (reason) {
      setError(`Could not publish recap: ${String(reason)}`)
      setOperation("idle")
      return
    }
    const url = published.url!
    let sms = attachSermonLink(draft.sms, url)
    const apiKey = useSettingsStore.getState().deepseekApiKey
    if (apiKey) {
      try {
        const generated = await invoke<string>("generate_linked_sms", {
          apiKey,
          recap: draft.recap,
          url,
        })
        if (!generated.endsWith(url) || smsMetrics(generated).segments > 1)
          throw new Error("SMS exceeds one part")
        sms = generated
      } catch {
        setError(
          "Recap published. The link was added to your SMS; review its length before using it."
        )
      }
    }
    const next = { ...draft, sms }
    setDraft(next)
    try {
      await invoke("save_sharing_draft", { sessionId, draft: next })
      setSaved(next)
    } catch {
      setError(
        "Recap published, but the updated SMS could not be saved. Click Save drafts to retry."
      )
    } finally {
      setOperation("idle")
    }
  }
  return {
    draft,
    operation,
    error,
    publication,
    publish,
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
