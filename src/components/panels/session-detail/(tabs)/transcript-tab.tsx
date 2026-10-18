import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchIcon, PencilIcon } from "lucide-react"
import type { SermonSession, SessionTranscriptSegment } from "@/types/session"
import { SessionAudioPlayer } from "@/components/session-audio-player"
import { TranscriptRow } from "../(components)/transcript-row"
import type { useTranscriptEditor } from "../(hooks)/use-transcript-editor"
interface TranscriptTabProps {
  session: SermonSession | null
  sessionId: number
  audioNonce: number
  transcript: SessionTranscriptSegment[]
  editor: ReturnType<typeof useTranscriptEditor>
}
export function TranscriptTab({
  session,
  sessionId,
  audioNonce,
  transcript,
  editor,
}: TranscriptTabProps) {
  const { search, mode, segment } = editor
  return (
    <div className="flex flex-col gap-2 p-3">
      {session?.audioPath && session?.startedAt && (
        <SessionAudioPlayer
          // Remount after a lazy merge so the player re-fetches the
          // freshly-concatenated audio.
          key={audioNonce}
          sessionId={sessionId}
          // SQLite `datetime('now')` emits `"YYYY-MM-DD HH:MM:SS"` in
          // UTC with no timezone marker. JS `new Date(...)` parses it as
          // *local* time, but transcript `timestampMs` is a true UTC
          // epoch ms, so subtraction would be off by the local TZ
          // offset for any non-UTC user. Force UTC parsing by inserting
          // `T` and appending `Z`.
          startedAtMs={new Date(
            `${session.startedAt.replace(" ", "T")}Z`
          ).getTime()}
        />
      )}
      {transcript.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          No transcript recorded
        </p>
      ) : (
        <>
          <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 pb-2 backdrop-blur-sm">
            <div className="relative flex-1">
              <SearchIcon className="absolute top-1/2 left-2 size-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search.query}
                onChange={(e) => search.setQuery(e.target.value)}
                placeholder="Search transcript…"
                className="h-7 pl-7 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant={mode.editing ? "default" : "outline"}
              onClick={mode.toggle}
              className="h-7 gap-1 text-xs"
            >
              <PencilIcon className="size-3" />
              {mode.editing ? "Done" : "Edit"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {search.query.trim().length > 0
              ? `${search.results.length} match${search.results.length === 1 ? "" : "es"}`
              : `${transcript.length} segments`}
          </p>
          <div className="flex flex-col gap-2">
            {search.results.map((seg) => (
              <TranscriptRow
                key={seg.id}
                segment={seg}
                query={search.query}
                editMode={mode.editing}
                editing={segment.id === seg.id}
                draft={segment.draft}
                onStartEdit={() => segment.start(seg)}
                onCancelEdit={segment.cancel}
                onChangeDraft={segment.setDraft}
                onSaveEdit={segment.save}
                onDelete={() => segment.delete(seg.id)}
              />
            ))}
            {search.results.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No matching segments.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
