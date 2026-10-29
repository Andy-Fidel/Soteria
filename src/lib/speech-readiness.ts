import { invoke } from "@tauri-apps/api/core"
import type { SttProvider } from "@/stores/settings-store"

let localPreparation: Promise<string> | null = null

export async function prepareSpeechReadiness(
  provider: SttProvider,
  key: string | null
): Promise<{ status: "pass" | "fail" | "warning"; detail: string }> {
  if (provider !== "whisper" && !key?.trim()) {
    return {
      status: "fail",
      detail: "Add your speech API key in Settings → API Keys.",
    }
  }
  try {
    if (provider === "whisper") {
      // Strict Mode and overlapping settings/preflight checks share one model load.
      localPreparation ??= invoke<string>("prepare_local_speech").finally(
        () => {
          localPreparation = null
        }
      )
      return { status: "pass", detail: await localPreparation }
    }
    await invoke("prepare_stt_connection", { provider })
    return {
      status: "pass",
      detail:
        "Connection prepared. Listening starts when you start the service.",
    }
  } catch (error) {
    return provider === "whisper"
      ? {
          status: "fail",
          detail:
            error instanceof TypeError
              ? "Local speech checks require the Soteria desktop app. Open it and try again."
              : String(error),
        }
      : {
          status: "warning",
          detail:
            "Could not prepare the connection. We’ll retry when you start.",
        }
  }
}
