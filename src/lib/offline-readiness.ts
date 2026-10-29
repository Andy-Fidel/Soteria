import { invoke } from "@tauri-apps/api/core"
import { prepareSpeechReadiness } from "./speech-readiness"

export interface LocalResourceStatus {
  translations: string[]
  quotationReady: boolean
  semanticReady: boolean
  sessionStorageReady: boolean
}
export interface OfflineCheck {
  id: "bible" | "quotation" | "semantic" | "storage" | "speech"
  label: string
  status: "pass" | "warning" | "fail"
  detail: string
}

/** A missing optional semantic index must not disable manual scripture presentation. */
export function describeLocalResources(
  resources: LocalResourceStatus
): OfflineCheck[] {
  return [
    {
      id: "bible",
      label: "Bible text",
      status: resources.translations.length ? "pass" : "fail",
      detail: resources.translations.length
        ? `Available locally: ${resources.translations.join(", ")}.`
        : "Bible text is missing or could not be loaded. Install the complete offline package, then restart Soteria.",
    },
    {
      id: "quotation",
      label: "Quotation matching",
      status: resources.quotationReady ? "pass" : "warning",
      detail: resources.quotationReady
        ? "The local quotation index is ready."
        : "Quotation matching is unavailable. Manual Bible lookup and direct references can still work.",
    },
    {
      id: "semantic",
      label: "Paraphrase detection",
      status: resources.semanticReady ? "pass" : "warning",
      detail: resources.semanticReady
        ? "The local semantic model and verse index are loaded."
        : "Paraphrase detection is not ready in this build. Use a supported full offline build with its models installed; Bible lookup and direct references remain available.",
    },
    {
      id: "storage",
      label: "Session storage",
      status: resources.sessionStorageReady ? "pass" : "fail",
      detail: resources.sessionStorageReady
        ? "The local session database is open."
        : "The local session database is unavailable. Restart Soteria and check access to its data folder.",
    },
  ]
}

export async function checkLocalResources(): Promise<OfflineCheck[]> {
  try {
    return describeLocalResources(
      await invoke<LocalResourceStatus>("get_local_resource_status")
    )
  } catch (error) {
    console.warn("[offline] Could not inspect native resources", error)
    return [
      {
        id: "bible",
        label: "Local resources",
        status: "fail",
        detail:
          "Could not check local resources. Open the Soteria desktop app and try again. If it is already open, restart it and recheck the offline package.",
      },
    ]
  }
}

export async function checkOfflineReadiness(): Promise<OfflineCheck[]> {
  const [resources, speech] = await Promise.all([
    checkLocalResources(),
    prepareSpeechReadiness("whisper", null),
  ])
  return [
    { id: "speech", label: "Local speech recognition", ...speech },
    ...resources,
  ]
}
