import { useState } from "react"
import { useSession } from "@/hooks/use-session"
import { useSessionStore } from "@/stores/session-store"
import type { CreateSessionRequest } from "@/types/session"

export function CreateSessionForm({ onCreated }: { onCreated: () => void }) {
  const { createSession, startSession } = useSession()
  const [title, setTitle] = useState(() => {
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
  })
  const [titleEdited, setTitleEdited] = useState(false)
  const [speaker, setSpeaker] = useState("")
  const [seriesName, setSeriesName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setIsCreating(true)
    try {
      const request: CreateSessionRequest = {
        title: title.trim(),
        titleIsAutomatic: !titleEdited,
        speaker: speaker.trim() || undefined,
        date: new Date().toISOString().split("T")[0],
        seriesName: seriesName.trim() || undefined,
      }
      const session = await createSession(request)
      const started = await startSession(session.id)
      useSessionStore.getState().setActiveSession(started)
      const next = new Date()
      const nextDate = next.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
      const nextTime = next.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      setTitle(`${nextDate} — ${nextTime}`)
      setTitleEdited(false)
      setSpeaker("")
      setSeriesName("")
      onCreated()
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 border-b border-border p-3"
    >
      <p className="text-xs font-medium text-muted-foreground">New Session</p>
      <input
        className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        placeholder="Session title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          setTitleEdited(true)
        }}
        required
      />
      <input
        className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        placeholder="Speaker"
        value={speaker}
        onChange={(e) => setSpeaker(e.target.value)}
      />
      <input
        className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        placeholder="Series name"
        value={seriesName}
        onChange={(e) => setSeriesName(e.target.value)}
      />
      <button
        type="submit"
        disabled={!title.trim() || isCreating}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isCreating ? "Creating…" : "Create & Start Session"}
      </button>
    </form>
  )
}
