import { useState, useEffect, useRef } from "react"
import type { Dispatch, SetStateAction } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { CheckIcon, XIcon, TagIcon, PencilIcon } from "lucide-react"
import type { SermonSession } from "@/types/session"
import { AddTagInline } from "./add-tag-inline"
export function SessionMetadata({
  session,
  sessionId,
  setSession,
}: {
  session: SermonSession | null
  sessionId: number
  setSession: Dispatch<SetStateAction<SermonSession | null>>
}) {
  // Series + tag editing
  const [seriesEditing, setSeriesEditing] = useState(false)
  const [seriesDraft, setSeriesDraft] = useState("")
  const [seriesOptions, setSeriesOptions] = useState<string[]>([])
  const seriesRef = useRef<HTMLDivElement>(null)

  // Load distinct series list for autocomplete suggestions.
  useEffect(() => {
    invoke<string[]>("list_session_series")
      .then(setSeriesOptions)
      .catch(() => setSeriesOptions([]))
  }, [])

  // Close series editor on outside click or Escape.
  useEffect(() => {
    if (!seriesEditing) return
    const onPointer = (e: MouseEvent) => {
      if (seriesRef.current && !seriesRef.current.contains(e.target as Node)) {
        setSeriesEditing(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSeriesEditing(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [seriesEditing])

  // ── Series ────────────────────────────────────────────────────────
  const openSeriesEditor = () => {
    setSeriesDraft(session?.seriesName ?? "")
    setSeriesEditing(true)
  }

  const saveSeries = async (value: string) => {
    const trimmed = value.trim()
    try {
      await invoke("update_session_series", {
        id: sessionId,
        series: trimmed.length > 0 ? trimmed : null,
      })
      setSession((s) =>
        s ? { ...s, seriesName: trimmed.length > 0 ? trimmed : null } : null
      )
      if (trimmed && !seriesOptions.includes(trimmed)) {
        setSeriesOptions((prev) =>
          [...prev, trimmed].sort((a, b) => a.localeCompare(b))
        )
      }
    } catch (e) {
      console.error("[session] update series failed:", e)
    }
    setSeriesEditing(false)
  }

  // ── Tags ──────────────────────────────────────────────────────────
  const persistTags = async (next: string[]) => {
    try {
      await invoke("update_session_tags", {
        id: sessionId,
        tagsJson: JSON.stringify(next),
      })
      setSession((s) => (s ? { ...s, tags: next } : null))
    } catch (e) {
      console.error("[session] update tags failed:", e)
    }
  }

  const addTag = (raw: string) => {
    const tag = raw.trim()
    if (!tag) return
    const existing = session?.tags ?? []
    if (existing.includes(tag)) return
    persistTags([...existing, tag])
  }

  const removeTag = (tag: string) => {
    const next = (session?.tags ?? []).filter((t) => t !== tag)
    persistTags(next)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1 pl-7">
      {/* Series chip */}
      <div className="relative" ref={seriesRef}>
        {seriesEditing ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={seriesDraft}
              onChange={(e) => setSeriesDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveSeries(seriesDraft)
                if (e.key === "Escape") setSeriesEditing(false)
              }}
              placeholder="Series name…"
              className="h-6 w-44 text-[11px]"
              list="series-suggestions"
            />
            <datalist id="series-suggestions">
              {seriesOptions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => void saveSeries(seriesDraft)}
              title="Save"
            >
              <CheckIcon className="size-3" />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              onClick={() => setSeriesEditing(false)}
              title="Cancel"
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        ) : session?.seriesName ? (
          <button
            onClick={openSeriesEditor}
            className="group inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary ring-1 ring-primary/20 hover:bg-primary/15"
            title="Edit series"
          >
            <TagIcon className="size-2.5" />
            {session.seriesName}
            <PencilIcon className="size-2 opacity-0 transition-opacity group-hover:opacity-60" />
          </button>
        ) : (
          <button
            onClick={openSeriesEditor}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
          >
            <TagIcon className="size-2.5" />
            Add series
          </button>
        )}
      </div>

      {/* Tag chips */}
      {session?.tags?.map((tag) => (
        <span
          key={tag}
          className="group inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground/80"
        >
          {tag}
          <button
            onClick={() => removeTag(tag)}
            className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
            title="Remove tag"
          >
            <XIcon className="size-2.5" />
          </button>
        </span>
      ))}

      {/* Add tag */}
      <AddTagInline onAdd={addTag} />
    </div>
  )
}
