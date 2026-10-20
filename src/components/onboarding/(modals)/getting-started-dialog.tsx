import { useSettingsStore, persistOnboardingComplete } from "@/stores/settings-store"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function GettingStartedDialog() {
  const hydrated = useSettingsStore((s) => s.settingsHydrated)
  const complete = useSettingsStore((s) => s.onboardingComplete)
  const provider = useSettingsStore((s) => s.sttProvider)
  if (!hydrated || complete) return null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) void persistOnboardingComplete() }}>
      <DialogContent className="max-w-md">
        <DialogTitle>Welcome to Manna</DialogTitle>
        <DialogDescription>
          {provider === "whisper"
            ? "English speech recognition and Bible search are included. No extra download or speech API key is needed."
            : "Choose your speech provider in Settings → Speech Recognition. Cloud speech needs your own API key."}
        </DialogDescription>
        <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
          <li>Allow microphone access when asked. Choose and test your input in Settings → Audio.</li>
          <li>Start a service to listen. Review detected scriptures in the queue, then go live.</li>
          <li>Connect a projector and use the projector control to choose its screen.</li>
          <li>AI titles and summaries are optional. Add your AI key in Settings → API Keys when you need them.</li>
        </ol>
        <Button onClick={() => void persistOnboardingComplete()}>Got it</Button>
      </DialogContent>
    </Dialog>
  )
}
