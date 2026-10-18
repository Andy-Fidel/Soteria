import { probeAudioLevel } from "./preflight-audio-probe"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { useSettingsStore } from "@/stores"
import { persistRecordAudio } from "@/stores/settings-store"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { CheckCircle2, XCircle, Mic, Key, Volume2, AlertCircle } from "lucide-react"

interface PreflightChecklistProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onStart: () => void
}

interface CheckItem {
  label: string
  status: "checking" | "pass" | "fail" | "warning"
  detail: string
  icon: React.ReactNode
}

export function PreflightChecklist({ open, ...props }: PreflightChecklistProps) {
  return open ? <PreflightChecklistContent {...props} /> : null
}

function PreflightChecklistContent({ onOpenChange, onStart }: Omit<PreflightChecklistProps, "open">) {
  const [checks, setChecks] = useState<CheckItem[]>([])
  const recordAudio = useSettingsStore((s) => s.recordAudio)

  useEffect(() => {
    let cancelled = false
    const runChecks = async () => {
      const settings = useSettingsStore.getState()
      const cloud = settings.sttProvider !== "whisper"
      const speechConnection = cloud
        ? invoke<boolean>("prepare_stt_connection", { provider: settings.sttProvider })
            .then(() => ({ status: "pass" as const, detail: "Connection prepared. Listening starts when you start the service." }))
            .catch(() => ({ status: "warning" as const, detail: "Could not prepare the connection. We’ll retry when you start." }))
        : Promise.resolve(null)
      const results: CheckItem[] = []

      // Check 1: Audio device
      try {
        const devices = await invoke<Array<{ name: string }> >("get_audio_devices")
        if (devices.length > 0) {
          results.push({
            label: "Audio Input",
            status: "pass",
            detail: devices[0].name || "Microphone detected",
            icon: <Mic className="size-4" />,
          })
        } else {
          results.push({
            label: "Audio Input",
            status: "fail",
            detail: "No microphone found. Connect a mic and try again.",
            icon: <Mic className="size-4" />,
          })
        }
      } catch {
        results.push({
          label: "Audio Input",
          status: "warning",
          detail: "Could not detect audio devices",
          icon: <Mic className="size-4" />,
        })
      }

      // Check 2: API Key
      if (settings.sttProvider === "deepgram") {
        results.push({
          label: "Deepgram API Key",
          status: settings.deepgramApiKey ? "pass" : "fail",
          detail: settings.deepgramApiKey
            ? "API key configured"
            : "No API key. Go to Settings → API Keys to add one.",
          icon: <Key className="size-4" />,
        })
      } else if (settings.sttProvider === "assemblyai") {
        results.push({
          label: "AssemblyAI API Key",
          status: settings.assemblyAiApiKey ? "pass" : "fail",
          detail: settings.assemblyAiApiKey
            ? "API key configured"
            : "No API key. Go to Settings → API Keys to add one.",
          icon: <Key className="size-4" />,
        })
      } else {
        results.push({
          label: "Whisper (Local)",
          status: "pass",
          detail: "Local speech recognition — no API key needed",
          icon: <Key className="size-4" />,
        })
      }

      // Check 3: Audio levels — actually probe the input stream for ~1s
      results.push({
        label: "Sound Check",
        status: "checking",
        detail: "Listening to mic for 1s…",
        icon: <Volume2 className="size-4" />,
      })
      const soundIndex = results.length - 1
      if (cloud) results.push({label: "Speech Connection", status: "checking", detail: "Preparing the speech connection…", icon: <CheckCircle2 className="size-4" />})
      if (cancelled) return
      setChecks([...results])

      const [soundResult, connectionResult] = await Promise.all([probeAudioLevel(), speechConnection])
      results[soundIndex] = {
        label: "Sound Check",
        status: soundResult.status,
        detail: soundResult.detail,
        icon: <Volume2 className="size-4" />,
      }

      if (connectionResult) results[results.length - 1] = {label: "Speech Connection", ...connectionResult, icon: <CheckCircle2 className="size-4" />}
      if (cancelled) return
      setChecks(results)
    }

    void runChecks()
    return () => { cancelled = true }
  }, [])

  const checking = checks.length === 0 || checks.some((check) => check.status === "checking")
  const ready = !checking && !checks.some((check) => check.status === "fail")

  const statusIcon = (status: CheckItem["status"]) => {
    switch (status) {
      case "pass": return <CheckCircle2 className="size-4 text-primary" />
      case "fail": return <XCircle className="size-4 text-destructive" />
      case "warning": return <AlertCircle className="size-4 text-amber-500" />
      case "checking": return <div className="size-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-base font-bold">Pre-Service Checklist</DialogTitle>

        <div className="mt-3 flex flex-col gap-2">
          {checks.map((check, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl p-3 ring-1 ${
                check.status === "pass" ? "bg-primary/5 ring-primary/15" :
                check.status === "fail" ? "bg-destructive/5 ring-destructive/15" :
                "bg-amber-500/5 ring-amber-500/15"
              }`}
            >
              <div className="mt-0.5 shrink-0 text-muted-foreground">{check.icon}</div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{check.label}</span>
                  {statusIcon(check.status)}
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">{check.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2 ring-1 ring-border/40">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-semibold">Record audio</span>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Save an MP3 recording of the session for later playback.
            </p>
          </div>
          <Switch
            checked={recordAudio}
            onCheckedChange={(checked) => void persistRecordAudio(checked)}
          />
        </div>

        <div className="mt-2 rounded-lg bg-muted/30 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            Recording will start immediately. All detections and transcripts will be saved to the session.
          </p>
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-full"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-full"
            disabled={!ready}
            onClick={() => {
              onOpenChange(false)
              onStart()
            }}
          >
            {checking ? "Preparing…" : ready ? "Start Service" : "Fix Issues First"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
