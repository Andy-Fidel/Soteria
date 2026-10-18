import { listen } from "@tauri-apps/api/event"

const remoteEvents = [
  "remote:next",
  "remote:prev",
  "remote:theme",
  "remote:on_air",
  "remote:show",
  "remote:hide",
  "remote:confidence",
]

/** Own every registration, including one that resolves after cleanup. */
export function subscribeRemoteCommands(onCommand: (command: string) => void) {
  let cancelled = false
  const unlisteners: (() => void)[] = []

  async function setup() {
    for (const event of remoteEvents) {
      const unlisten = await listen(event, () => {
        if (!cancelled) onCommand(event.replace("remote:", ""))
      })
      if (cancelled) {
        unlisten()
        return
      }
      unlisteners.push(unlisten)
    }
  }

  void setup().catch((error: unknown) => {
    console.warn("[settings] Failed to listen for remote commands", error)
  })

  return () => {
    cancelled = true
    unlisteners.forEach((unlisten) => unlisten())
  }
}
