import { listen, type EventCallback, type UnlistenFn } from "@tauri-apps/api/event"

/** Own asynchronous event registrations, including ones completed after cleanup. */
export function createTauriListenerScope() {
  let disposed = false
  const unlisteners = new Set<UnlistenFn>()

  const dispose = () => {
    disposed = true
    for (const unlisten of unlisteners) unlisten()
    unlisteners.clear()
  }

  const register = async <T>(event: string, handler: EventCallback<T>): Promise<void> => {
    if (disposed) return
    try {
      const unlisten = await listen<T>(event, (message) => {
        if (!disposed) handler(message)
      })
      if (disposed) unlisten()
      else unlisteners.add(unlisten)
    } catch (error) {
      dispose()
      throw error
    }
  }

  return { register, dispose }
}
