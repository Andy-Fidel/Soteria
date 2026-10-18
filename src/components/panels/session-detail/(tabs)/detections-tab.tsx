import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { SessionDetection } from "@/types/session"
export function DetectionsTab({
  detections,
  showAllDetections,
  onToggle,
}: {
  detections: SessionDetection[]
  showAllDetections: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex flex-col gap-0.5 p-2">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[10px] tracking-wider text-muted-foreground uppercase">
          {showAllDetections
            ? `${detections.length} detected`
            : `${detections.filter((d) => d.wasPresented).length} shown on screen`}
        </span>
        <Button
          size="xs"
          variant="ghost"
          onClick={onToggle}
          className="h-6 text-[10px]"
        >
          {showAllDetections ? "Shown only" : "Show all"}
        </Button>
      </div>
      {(() => {
        const filtered = showAllDetections
          ? detections
          : detections.filter((d) => d.wasPresented)
        if (filtered.length === 0) {
          return (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {showAllDetections
                ? "No detections recorded"
                : "No verses went live in this session"}
            </p>
          )
        }
        return filtered.map((d, i) => (
          <div key={i} className="rounded-lg p-2 hover:bg-muted/30">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary">
                {d.verseRef}
              </span>
              <span className="text-[9px] text-muted-foreground tabular-nums">
                {Math.round(d.confidence * 100)}%
              </span>
              <Badge variant="outline" className="text-[8px]">
                {d.source}
              </Badge>
              {d.wasPresented && (
                <Badge className="bg-primary/15 text-[8px] text-primary">
                  Shown
                </Badge>
              )}
            </div>
            {d.verseText && (
              <p className="mt-0.5 line-clamp-1 font-serif text-[11px] text-muted-foreground">
                {d.verseText}
              </p>
            )}
          </div>
        ))
      })()}
    </div>
  )
}
