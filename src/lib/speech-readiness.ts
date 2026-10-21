import { invoke } from "@tauri-apps/api/core"
import type { SttProvider } from "@/stores/settings-store"

export async function prepareSpeechReadiness(provider: SttProvider, key: string | null): Promise<{ status: "pass" | "fail" | "warning"; detail: string }> {
  if (provider !== "whisper" && !key?.trim()) {
    return { status: "fail", detail: "Add your speech API key in Settings → API Keys." }
  }
  try {
    if (provider === "whisper") {
      return { status: "pass", detail: await invoke<string>("prepare_local_speech") }
    }
    await invoke("prepare_stt_connection", { provider })
    return { status: "pass", detail: "Connection prepared. Listening starts when you start the service." }
  } catch (error) {
    return provider === "whisper"
      ? { status: "fail", detail: String(error) }
      : { status: "warning", detail: "Could not prepare the connection. We’ll retry when you start." }
  }
}
