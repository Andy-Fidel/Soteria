import { Button } from "@/components/ui/button"
import { Trash2Icon } from "lucide-react"
import { formatAudioTime } from "@/lib/session-audio-timeline"
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
  seconds?: number | null
  canSeek?: boolean
  active?: boolean
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
  seconds,
  canSeek = false,
  active = false,
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
    <div
      aria-current={active ? "true" : undefined}
      className={`group flex items-start gap-3 rounded-lg px-3 py-3 [contain-intrinsic-size:auto_90px] [content-visibility:auto] ${active ? "bg-primary/8" : ""}`}
    >
      <button
        type="button"
        onClick={() => emitAudioSeek(segment.timestampMs)}
        disabled={!canSeek || seconds == null}
        className="mt-1 min-w-11 shrink-0 rounded py-0.5 text-left text-[11px] font-medium text-primary tabular-nums hover:underline disabled:text-muted-foreground disabled:no-underline"
        aria-label={
          canSeek && seconds != null
            ? `Play from ${formatAudioTime(seconds)}`
            : "Recording unavailable"
        }
      >
        {seconds == null ? "—" : formatAudioTime(seconds)}
      </button>
      <p
        onClick={editMode ? onStartEdit : undefined}
        className={`min-w-0 flex-1 text-sm leading-[1.85] break-words text-foreground/90 ${editMode ? "-mx-1 cursor-text rounded px-1 hover:bg-muted/40" : ""}`}
      >
        {highlightMatches(segment.text, query)}
      </p>
      {editMode && (
        <button
          onClick={onDelete}
          className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Delete segment"
        >
          <Trash2Icon className="size-3" />
        </button>
      )}
    </div>
  )
}
