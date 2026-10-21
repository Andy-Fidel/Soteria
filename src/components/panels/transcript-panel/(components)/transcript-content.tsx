import { memo, useEffect, useRef } from "react"
import { AudioLinesIcon } from "lucide-react"
import { useTranscriptStore } from "@/stores/transcript-store"
import type { TranscriptSegment } from "@/types"

const CompletedLines = memo(function CompletedLines({
  segments,
}: {
  segments: TranscriptSegment[]
}) {
  return (
    <>
      {segments.map((seg, idx) => {
        const distFromEnd = segments.length - 1 - idx
        const opacity =
          distFromEnd === 0
            ? "text-foreground/80"
            : distFromEnd === 1
              ? "text-foreground/60"
              : distFromEnd <= 3
                ? "text-foreground/40"
                : "text-foreground/25"
        return (
          <p
            key={seg.id}
            className={`text-sm leading-relaxed transition-colors duration-300 ${opacity}`}
          >
            {seg.text}
          </p>
        )
      })}
    </>
  )
})

export function TranscriptContent({
  isTranscribing,
}: {
  isTranscribing: boolean
}) {
  const segments = useTranscriptStore((state) => state.segments)
  const currentPartial = useTranscriptStore((state) => state.currentPartial)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [segments, currentPartial])

  return (
    <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-2 p-3">
        {/* Faded top gradient */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b from-card to-transparent" />

        {segments.length === 0 && !currentPartial && !isTranscribing && (
          <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted/50">
              <AudioLinesIcon className="size-5 text-muted-foreground/60" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                No transcript yet
              </p>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground/60">
                Click &ldquo;Start transcribing&rdquo; in the toolbar to begin
                capturing the sermon.
              </p>
            </div>
          </div>
        )}

        <CompletedLines segments={segments} />

        {/* Partial (in-progress) text — larger and brighter than final segments */}
        {currentPartial && (
          <p className="border-l-2 border-primary pl-2 text-base leading-relaxed text-foreground">
            {currentPartial}
            <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-primary align-middle" />
          </p>
        )}
      </div>
    </div>
  )
}
