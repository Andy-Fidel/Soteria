import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { CompassIcon, MicIcon, PlayIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSession } from "@/hooks/use-session"
import { useSessionStore, useBroadcastStore } from "@/stores"
import { useProjectorPicker } from "@/lib/projector-picker"

interface MonitorInfo {
  is_primary: boolean
  name: string
  width: number
  height: number
  x: number
  y: number
  scale: number
}

export function CreateSessionForm() {
  const { createSession } = useSession()
  const workspaceUnlocked = useSessionStore((s) => s.workspaceUnlocked)
  const closeSessions = useSessionStore((s) => s.closeSessions)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState(defaultTitle)
  const [titleEdited, setTitleEdited] = useState(false)
  const [speaker, setSpeaker] = useState("")
  const [seriesName, setSeriesName] = useState("")
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setCreating(true)
    try {
      const now = new Date()
      const created = await createSession({
        title: title.trim(),
        titleIsAutomatic: !titleEdited,
        date: now.toISOString().split("T")[0],
        ...(speaker.trim() ? { speaker: speaker.trim() } : {}),
        ...(seriesName.trim() ? { seriesName: seriesName.trim() } : {}),
      })
      // Don't start the session yet — keep it in "planned" status so the
      // elapsed timer doesn't tick until the operator confirms Start Service
      // in the preflight checklist.
      useSessionStore.getState().setActiveSession(created)

      // Default the projector to a blank EWC-logo screen so we never boot
      // into a black void while operator gets situated.
      useBroadcastStore.getState().setBlankLogo(true)

      const monitors = await invoke<MonitorInfo[]>("list_monitors")
      console.info("[landing] monitors:", monitors)
      closeSessions()
      // Picker is mounted globally inside Workspace, so it survives the
      // landing component unmount that happens the moment we set an active
      // session above.
      let idx: number | null = 0
      if (monitors.length > 1) {
        idx = await useProjectorPicker.getState().open(monitors)
      }
      if (idx != null) {
        useBroadcastStore.getState().setProjectorMonitorIndex(idx)
        await invoke("open_broadcast_window", {
          outputId: "main",
          monitorIndex: idx,
        })
        // Window just mounted — re-emit current state so it picks up the
        // blank-logo flag we set before opening (initial emit was lost
        // because the window didn't exist yet).
        setTimeout(
          () => useBroadcastStore.getState().syncBroadcastOutput(),
          400
        )
      }

      // Auto-open preflight in the workspace so the operator can immediately
      // start transcription without a second click.
      useSessionStore.getState().requestServiceStart()
    } catch (err) {
      console.error("[landing] create session failed:", err)
    } finally {
      setCreating(false)
    }
  }

  const handleExplore = () => {
    useSessionStore.getState().unlockWorkspace()
    closeSessions()
  }
  return (
    <form
      onSubmit={handleCreate}
      className="sticky top-4 z-10 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_0_rgba(0,0,0,0.04)]"
    >
      <div className="flex items-center gap-2">
        <MicIcon className="size-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
          Start a new session
        </h2>
      </div>
      <Input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          setTitleEdited(true)
        }}
        placeholder="Session title"
        className="h-9"
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value)}
          placeholder="Speaker (optional)"
          className="h-9"
        />
        <Input
          value={seriesName}
          onChange={(e) => setSeriesName(e.target.value)}
          placeholder="Series (optional)"
          className="h-9"
        />
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        {!workspaceUnlocked ? (
          <Button
            type="button"
            variant="secondary"
            onClick={handleExplore}
            className="gap-1.5"
          >
            <CompassIcon className="size-3.5" />
            Just explore — skip session
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          disabled={creating || !title.trim()}
          className="gap-1.5"
        >
          <PlayIcon className="size-3.5" />
          {creating ? "Starting…" : "Start session"}
        </Button>
      </div>
    </form>
  )
}

function defaultTitle(): string {
  const now = new Date()
  const date = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  return `${date} — ${time}`
}
