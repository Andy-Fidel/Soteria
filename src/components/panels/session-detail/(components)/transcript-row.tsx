import { Button } from "@/components/ui/button"
import { PlayIcon, Trash2Icon } from "lucide-react"
import type { SessionTranscriptSegment } from "@/types/session"
import { emitAudioSeek } from "@/hooks/use-audio-seek"
function highlightMatches(text: string, query: string): React.ReactNode {
  const q = query.trim()
  if (q.length < 2) return text
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig")
  const parts = text.split(re)
  return parts.map((p, i) =>
    re.test(p) ? (
      <mark
        key={i}
        className="rounded-[2px] bg-amber-300/30 px-0.5 text-foreground"
      >
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    )
  )
}

interface TranscriptRowProps {
  segment: SessionTranscriptSegment
  query: string
  editMode: boolean
  editing: boolean
  draft: string
  onStartEdit: () => void
  onCancelEdit: () => void
  onChangeDraft: (v: string) => void
  onSaveEdit: () => void
  onDelete: () => void
}

export function TranscriptRow({
  segment,
  query,
  editMode,
  editing,
  draft,
  onStartEdit,
  onCancelEdit,
  onChangeDraft,
  onSaveEdit,
  onDelete,
}: TranscriptRowProps) {
  if (editing) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-primary/30 bg-primary/5 p-2">
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => onChangeDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              onSaveEdit()
            } else if (e.key === "Escape") {
              onCancelEdit()
            }
          }}
          className="min-h-[60px] w-full resize-y rounded bg-background p-2 text-sm leading-relaxed"
        />
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancelEdit}
            className="h-6 text-xs"
          >
            Cancel
          </Button>
          <Button size="sm" onClick={onSaveEdit} className="h-6 text-xs">
            Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-1">
      <button
        type="button"
        onClick={() => emitAudioSeek(segment.timestampMs)}
        className="mt-0.5 shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/10 hover:text-primary"
        title="Play from here"
      >
        <PlayIcon className="size-3" />
      </button>
      <p
        onClick={editMode ? onStartEdit : undefined}
        className={`flex-1 text-sm leading-relaxed text-foreground/80 ${editMode ? "-mx-1 cursor-text rounded px-1 hover:bg-muted/40" : ""}`}
      >
        {highlightMatches(segment.text, query)}
      </p>
      {editMode && (
        <button
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
          title="Delete segment"
        >
          <Trash2Icon className="size-3" />
        </button>
      )}
    </div>
  )
}
