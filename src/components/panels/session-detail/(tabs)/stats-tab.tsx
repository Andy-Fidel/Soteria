import type {
  SessionDetection,
  SessionTranscriptSegment,
} from "@/types/session"
export function StatsTab({
  detections,
  transcript,
}: {
  detections: SessionDetection[]
  transcript: SessionTranscriptSegment[]
}) {
  const presentedCount = detections.filter((d) => d.wasPresented).length
  const uniqueBooks = new Set(detections.map((d) => d.verseRef.split(" ")[0]))
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-lg font-bold text-foreground">
            {detections.length}
          </p>
          <p className="text-[10px] text-muted-foreground">Detections</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-lg font-bold text-foreground">{presentedCount}</p>
          <p className="text-[10px] text-muted-foreground">Shown on Screen</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-lg font-bold text-foreground">
            {uniqueBooks.size}
          </p>
          <p className="text-[10px] text-muted-foreground">Books Referenced</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="text-lg font-bold text-foreground">
            {transcript.length}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Transcript Segments
          </p>
        </div>
      </div>
    </div>
  )
}
