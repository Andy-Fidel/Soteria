import { useEffect, useEffectEvent } from "react"
import { listen, type UnlistenFn } from "@tauri-apps/api/event"

export function useTauriEvent<T>(
  event: string,
  handler: (payload: T) => void
) {
  const onEvent = useEffectEvent(handler)

  useEffect(() => {
    // Track whether this effect has been cleaned up.
    // React StrictMode unmounts/remounts effects, and the listen() Promise
    // may resolve after cleanup — the cancelled flag prevents stale listeners.
    let cancelled = false
    let unlisten: UnlistenFn | undefined

    listen<T>(event, (e) => {
      if (!cancelled) {
        onEvent(e.payload)
      }
    }).then((fn) => {
      if (cancelled) {
        // Effect was already cleaned up before the listener registered — remove it immediately
        fn()
      } else {
        unlisten = fn
      }
    }).catch((error: unknown) => {
      if (!cancelled) console.error(`Failed to listen for ${event}`, error)
    })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [event])
}
