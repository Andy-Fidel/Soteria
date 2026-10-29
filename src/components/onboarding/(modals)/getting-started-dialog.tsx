import { useSettingsStore, persistOnboardingComplete } from "@/stores/settings-store"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AppLogo } from "@/components/app-logo"
import { openSettings } from "@/lib/settings-dialog"

export function GettingStartedDialog() {
  const hydrated = useSettingsStore((s) => s.settingsHydrated)
  const complete = useSettingsStore((s) => s.onboardingComplete)
  const provider = useSettingsStore((s) => s.sttProvider)
  if (!hydrated || complete) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) void persistOnboardingComplete() }}>
      <DialogContent className="max-w-md">
        <AppLogo className="mx-auto h-auto w-48 rounded-lg" />
        <DialogTitle>Welcome to Soteria</DialogTitle>
        <DialogDescription>
          {provider === "whisper"
            ? "Local English speech and Bible search can work without internet. Check offline readiness to verify this installation."
            : "Choose your speech provider in Settings → Speech Recognition. Cloud speech needs your own API key."}
        </DialogDescription>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
          <li>Allow microphone access when asked. Choose and test your input in Settings → Audio.</li>
          <li>Start a service to listen. Review detected scriptures in the queue, then go live.</li>
          <li>Connect a projector and use the projector control to choose its screen.</li>
          <li>AI titles and summaries are optional. Add your AI key in Settings → API Keys when you need them.</li>
        </ol>
        <Button variant="outline" onClick={() => {
          void persistOnboardingComplete()
          openSettings("offline")
        }}>Check offline readiness</Button>
        <Button onClick={() => void persistOnboardingComplete()}>Got it</Button>
      </DialogContent>
    </Dialog>
  )
}
