import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  checkOfflineReadiness,
  type OfflineCheck,
} from "@/lib/offline-readiness"
import { useSettingsStore, persistSttProvider } from "@/stores"
import { toast } from "sonner"

export function OfflineSection() {
  const provider = useSettingsStore((state) => state.sttProvider)
  const [checks, setChecks] = useState<OfflineCheck[]>([])
  const [checking, setChecking] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void checkOfflineReadiness().then((result) => {
      if (!cancelled) {
        setChecks(result)
        setChecking(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const ready =
    checks.length > 0 && checks.every((check) => check.status === "pass")
  const unavailable = checks.some((check) => check.status === "fail")
  const speechReady = checks.some(
    (check) => check.id === "speech" && check.status === "pass"
  )
  const selectLocalSpeech = async () => {
    setSaving(true)
    try {
      if (!(await persistSttProvider("whisper"))) throw new Error("Save failed")
    } catch {
      toast.error("Could not save the speech provider. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Offline service readiness</h3>
        <p className="text-sm text-muted-foreground">
          Bible lookup, scripture detection, saved songs, service plans, slides,
          recording, session review, and projector output work locally when
          their resources are installed.
        </p>
        <p role="status" aria-live="polite" className="text-sm font-medium">
          {checking
            ? "Checking local resources and loading the speech model…"
            : ready
              ? "All offline resources are ready."
              : unavailable
                ? "Offline setup needs attention."
                : "Local resources are ready; some detection features are limited."}
        </p>
      </div>
      <ul
        className="space-y-3"
        aria-label="Offline resource checks"
        aria-busy={checking}
      >
        {checks.map((check) => (
          <li key={check.id} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">{check.label}</span>
              <span
                className={
                  check.status === "fail"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }
              >
                {check.status === "pass"
                  ? "Ready"
                  : check.status === "warning"
                    ? "Limited"
                    : "Unavailable"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={checking}
          onClick={() => {
            setChecking(true)
            setChecks([])
            setAttempt((value) => value + 1)
          }}
        >
          {checking ? "Checking…" : "Check again"}
        </Button>
        {provider !== "whisper" && (
          <Button
            disabled={checking || !speechReady || saving}
            onClick={() => void selectLocalSpeech()}
          >
            {saving ? "Saving…" : "Use local speech"}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {provider === "whisper"
          ? "Local speech is selected. No speech API key is required."
          : "A cloud speech provider is selected and needs internet. Choose local speech before disconnecting."}
      </p>
      <div className="space-y-2 rounded-lg bg-muted/30 p-4 text-xs text-muted-foreground">
        <p>
          Missing resources? Install a complete Soteria offline installer before
          the service. Developers can provision a verified resource pack with
          the offline setup command described in the project documentation.
        </p>
        <p>
          AI summaries, AI notes and titles, online image/song lookup, website
          publishing, and SMS still require internet. They are optional; local
          service presentation does not depend on them.
        </p>
      </div>
    </div>
  )
}
