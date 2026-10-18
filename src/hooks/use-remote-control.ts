import { useEffect } from "react"
import { createTauriListenerScope } from "@/lib/tauri-listener-scope"
import { invoke } from "@tauri-apps/api/core"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { useBibleStore } from "@/stores/bible-store"
import { useQueueStore } from "@/stores/queue-store"
import { useSettingsStore } from "@/stores/settings-store"
import { queueVerseToRenderData } from "@/hooks/use-broadcast"
import type { Verse } from "@/types"

/**
 * Listens for remote control events from the Rust backend (OSC / HTTP API)
 * and dispatches them to the appropriate Zustand stores.
 *
 * Mount this hook once at the app root level.
 */
export function useRemoteControl() {
  useEffect(() => {
    let cancelled = false
    const listeners = createTauriListenerScope()

    async function setup() {
      // remote:next — advance queue to next verse and present it
      await listeners.register("remote:next", () => {
        if (cancelled) return
        const { items, activeIndex } = useQueueStore.getState()
        if (items.length === 0) return

        const currentIndex = activeIndex ?? findCurrentVerseIndex()
        const nextIndex = Math.min(
          currentIndex === null ? 0 : currentIndex + 1,
          items.length - 1
        )
        useQueueStore.getState().setActive(nextIndex)
        presentQueueItem(nextIndex)
      })

      // remote:prev — go to previous verse in queue and present it
      await listeners.register("remote:prev", () => {
        if (cancelled) return
        const { items, activeIndex } = useQueueStore.getState()
        if (items.length === 0) return

        const currentIndex = activeIndex ?? findCurrentVerseIndex()
        const prevIndex = Math.max(
          currentIndex === null ? 0 : currentIndex - 1,
          0
        )
        useQueueStore.getState().setActive(prevIndex)
        presentQueueItem(prevIndex)
      })

      // remote:theme — switch active theme by name
      await listeners.register<string>("remote:theme", (event) => {
        if (cancelled) return
        const payload = parsePayload(event.payload)
        const name = payload?.name as string | undefined
        if (!name) return

        const { themes } = useBroadcastStore.getState()
        const theme = themes.find(
          (t) => t.name.toLowerCase() === name.toLowerCase()
        )
        if (theme) {
          useBroadcastStore.getState().setActiveTheme(theme.id)
        }
      })

      // remote:on_air — toggle live broadcast state
      await listeners.register<string>("remote:on_air", (event) => {
        if (cancelled) return
        const payload = parsePayload(event.payload)
        const active = payload?.active as boolean | undefined
        if (active === undefined) return
        useBroadcastStore.getState().setLive(active)
      })

      // remote:show — show broadcast output
      await listeners.register("remote:show", () => {
        if (cancelled) return
        useBroadcastStore.getState().setLive(true)
      })

      // remote:hide — hide broadcast output
      await listeners.register("remote:hide", () => {
        if (cancelled) return
        useBroadcastStore.getState().setLive(false)
      })

      // remote:confidence — set detection confidence threshold
      await listeners.register<string>("remote:confidence", (event) => {
        if (cancelled) return
        const payload = parsePayload(event.payload)
        const value = payload?.value as number | undefined
        if (value === undefined) return
        useSettingsStore.getState().setConfidenceThreshold(value)
      })
    }

    void setup().catch((error: unknown) => {
      console.warn("[remote-control] Failed to register events", error)
    })

    // Only push status when the HTTP API server is actually running —
    // otherwise we wake every second to invoke a backend command that
    // immediately errors. Poll the server's running flag at a slow cadence
    // and run the fast push loop only while it's up.
    let pushInterval: ReturnType<typeof setInterval> | null = null
    let httpRunning = false

    const ensurePushLoop = (running: boolean) => {
      if (running && !pushInterval) {
        pushInterval = setInterval(syncStatusSnapshot, 1000)
        // Push immediately so the first /api/v1/status hit isn't stale.
        syncStatusSnapshot()
      } else if (!running && pushInterval) {
        clearInterval(pushInterval)
        pushInterval = null
      }
    }

    const checkHttpStatus = async () => {
      try {
        const status = await invoke<{ running: boolean }>("get_http_status")
        if (cancelled) return
        if (status.running !== httpRunning) {
          httpRunning = status.running
          ensurePushLoop(httpRunning)
        }
      } catch {
        if (httpRunning) {
          httpRunning = false
          ensurePushLoop(false)
        }
      }
    }

    checkHttpStatus()
    const pollInterval = setInterval(checkHttpStatus, 5000)

    return () => {
      cancelled = true
      listeners.dispose()
      clearInterval(pollInterval)
      if (pushInterval) clearInterval(pushInterval)
    }
  }, [])
}

/**
 * Find the index of the currently displayed verse in the queue.
 * Returns null if the live verse doesn't match any queue item.
 */
function findCurrentVerseIndex(): number | null {
  const { liveVerse } = useBroadcastStore.getState()
  if (!liveVerse) return null

  const { items } = useQueueStore.getState()
  const index = items.findIndex(
    (item) => item.kind !== "image" && item.reference === liveVerse.reference
  )
  return index >= 0 ? index : null
}

/**
 * Present a queue item at the given index to the live display.
 * Mirrors the logic from QueueItemRow's handlePresent.
 */
export async function presentQueueItem(index: number) {
  try {
    const { items } = useQueueStore.getState()
    const item = items[index]
    if (!item) return
    if (item.kind === "song-stanza") {
      // Song stanza — render via song-store lookup; no Bible DB fetch needed.
      const { useSongStore } = await import("@/stores")
      const { songStanzaToRenderData } = await import("@/lib/song-to-render")
      const song = useSongStore.getState().getSong(item.songId)
      const render = songStanzaToRenderData(item, song)
      if (render) useBroadcastStore.getState().setLiveVerse(render)
      return
    }

    if (item.kind !== "verse") return

    const { verse } = item

    // Fetch the full verse from the backend to ensure we have complete data
    // (AI-detected queue items may have partial verse objects)
    const fullVerse = item.chunk ? null : await invoke<Verse | null>("get_verse", {
      translationId: verse.translation_id,
      bookNumber: verse.book_number,
      chapter: verse.chapter,
      verse: verse.verse,
    })

    const verseToPresent = item.chunk ? verse : fullVerse ?? verse

    const bibleState = useBibleStore.getState()

    bibleState.selectVerse(verseToPresent)
    useBroadcastStore.getState().setLiveVerse(
      queueVerseToRenderData({ ...item, verse: verseToPresent }),
    )
  } catch (e) {
    console.warn("[remote-control] presentQueueItem failed:", e)
  }
}

/**
 * Push current frontend state to the Rust-managed StatusSnapshot.
 */
function syncStatusSnapshot() {
  const broadcast = useBroadcastStore.getState()
  const queue = useQueueStore.getState()
  const settings = useSettingsStore.getState()

  const activeTheme = broadcast.themes.find(
    (t) => t.id === broadcast.activeThemeId
  )

  invoke("update_remote_status", {
    onAir: broadcast.isLive,
    activeTheme: activeTheme?.name ?? null,
    liveVerse: broadcast.liveVerse?.reference ?? null,
    queueLength: queue.items.length,
    confidenceThreshold: settings.confidenceThreshold,
  }).catch(() => {
    // Silently ignore — HTTP server may not be running
  })
}

/**
 * Safely parse a JSON string payload from a Tauri event.
 */
function parsePayload(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw as Record<string, unknown>
  }
  return null
}
