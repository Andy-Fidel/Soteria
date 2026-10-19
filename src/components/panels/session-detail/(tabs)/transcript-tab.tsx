import { Button } from "@/components/ui/button"
import { useCallback, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { SearchIcon, PencilIcon } from "lucide-react"
import type { SermonSession, SessionTranscriptSegment } from "@/types/session"
import { SessionAudioPlayer } from "@/components/session-audio-player"
import { TranscriptRow } from "../(components)/transcript-row"
import type { useTranscriptEditor } from "../(hooks)/use-transcript-editor"
import { TranscriptArtwork } from "../(components)/transcript-artwork"
import {
  activeTranscriptId,
  sessionStartedAtMs,
} from "../(lib)/transcript-presentation"
import {
  sessionAudioSeekSeconds,
  type SessionAudioSpan,
} from "@/lib/session-audio-timeline"
interface TranscriptTabProps {
  session: SermonSession | null
  sessionId: number
  artworkTitle?: string
  audioNonce: number
  transcript: SessionTranscriptSegment[]
  editor: ReturnType<typeof useTranscriptEditor>
}
export function TranscriptTab({
  session,
  sessionId,
  audioNonce,
  artworkTitle,
  transcript,
  editor,
}: TranscriptTabProps) {
  const { search, mode, segment } = editor
  const [timeline, setTimeline] = useState<SessionAudioSpan[]>([])
  const [currentSegmentId, setCurrentSegmentId] = useState<number | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const startedAtMs = sessionStartedAtMs(session?.startedAt)
  const hasAudio = Boolean(session?.audioPath) && Number.isFinite(startedAtMs)
  const offsets = useMemo(
    () =>
      transcript.map((seg) => ({
        id: seg.id,
        seconds: sessionAudioSeekSeconds(
          seg.timestampMs,
          startedAtMs,
          timeline
        ),
      })),
    [transcript, startedAtMs, timeline]
  )
  const secondsById = useMemo(
    () => new Map(offsets.map((seg) => [seg.id, seg.seconds])),
    [offsets]
  )
  const handlePlaybackTime = useCallback(
    (seconds: number) => {
      setCurrentSegmentId(activeTranscriptId(offsets, seconds))
    },
    [offsets]
  )
  const activeId = audioReady ? currentSegmentId : null
  return (
    <div className="@container mx-auto max-w-6xl">
      <div className="grid items-start gap-7 p-5 @min-[760px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)] @min-[760px]:gap-10 @min-[760px]:p-7">
        <aside
          aria-label="Session recording"
          className="min-w-0 @min-[760px]:sticky @min-[760px]:top-6"
        >
          <TranscriptArtwork
            key={sessionId}
            sessionId={sessionId}
            title={artworkTitle || session?.title || "Session recording"}
            speaker={session?.speaker ?? null}
          />
          <h2 className="mt-4 text-base font-semibold tracking-tight">
            {artworkTitle || session?.title || "Session recording"}
          </h2>
          {session?.speaker && (
            <p className="mt-1 text-xs text-muted-foreground">
              {session.speaker}
            </p>
          )}
          {hasAudio ? (
            <SessionAudioPlayer
              // Remount after a lazy merge so the player re-fetches the
              // freshly-concatenated audio.
              key={audioNonce}
              sessionId={sessionId}
              startedAtMs={startedAtMs}
              onTimelineLoaded={setTimeline}
              onPlaybackTime={handlePlaybackTime}
              onReady={setAudioReady}
            />
          ) : (
            <p className="mt-5 text-xs text-muted-foreground">
              No recording available for this session.
            </p>
          )}
          <p className="mt-5 border-t pt-3 text-[11px] text-muted-foreground">
            {hasAudio
              ? "Select a transcript timestamp to play from that moment."
              : "You can still search and edit the transcript."}
          </p>
        </aside>
        <section aria-label="Transcript" className="min-w-0">
          {transcript.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No transcript recorded
            </p>
          ) : (
            <>
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-background/95 py-1 pb-3 backdrop-blur-sm">
                <div className="relative flex-1">
                  <SearchIcon className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search.query}
                    onChange={(e) => search.setQuery(e.target.value)}
                    placeholder="Search transcript…"
                    aria-label="Search transcript"
                    className="h-9 pl-9 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  variant={mode.editing ? "default" : "outline"}
                  onClick={mode.toggle}
                  aria-pressed={mode.editing}
                  className="h-9 gap-1.5 text-xs"
                >
                  <PencilIcon className="size-3" />
                  {mode.editing ? "Done" : "Edit"}
                </Button>
              </div>
              <p
                role="status"
                className="mb-3 text-[11px] text-muted-foreground"
              >
                {search.query.trim().length > 0
                  ? `${search.results.length} match${search.results.length === 1 ? "" : "es"}`
                  : `${transcript.length} segments`}
              </p>
              <div className="-mx-3 flex flex-col gap-1">
                {search.results.map((seg) => (
                  <TranscriptRow
                    key={seg.id}
                    segment={seg}
                    seconds={secondsById.get(seg.id)}
                    canSeek={audioReady}
                    active={seg.id === activeId}
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
        </section>
      </div>
    </div>
  )
}
