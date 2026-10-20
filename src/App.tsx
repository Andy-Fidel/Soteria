import { useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { emit } from "@tauri-apps/api/event"
import { Workspace } from "@/components/layout/workspace"
import { useRemoteControl } from "@/hooks/use-remote-control"
import { hydrateSettings, useSettingsStore } from "@/stores"
import { ResumeSessionDialog } from "@/components/resume-session-dialog"
import { SettingsDialog } from "@/components/settings-dialog"
import { Toaster } from "sonner"
import { GettingStartedDialog } from "@/components/onboarding/(modals)/getting-started-dialog"

export function App() {
  useRemoteControl()
  const hydrated = useSettingsStore((s) => s.settingsHydrated)

  useEffect(() => {
    void hydrateSettings().then(() => {
      const provider = useSettingsStore.getState().sttProvider
      if (provider !== "whisper") {
        void invoke("prepare_stt_connection", { provider }).catch(() => {})
      }
      // Push the persisted projector calibration with editing=false on every
      // app load. This (a) applies calibration to an already-open projector
      // window, and (b) clears a stuck calibration overlay if the main window
      // was hard-reloaded while the Settings → Projector panel was open (a
      // reload skips React unmount cleanup, so the editing=false emit never
      // fired).
      void emit("projector:calibration", {
        insets: useSettingsStore.getState().projectorCalibration,
        editing: false,
      }).catch(() => {})
    })
  }, [])

  if (!hydrated) return <div className="p-6 text-sm text-muted-foreground">Opening Manna…</div>

  return (
    <>
      <Workspace />
      <ResumeSessionDialog />
      {/* Mounted at root so it works on the landing screen too, not just
          once a workspace toolbar is visible. */}
      <SettingsDialog />
      <GettingStartedDialog />
      <Toaster position="top-right" />
    </>
  )
}

export default App
