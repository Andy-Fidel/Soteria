import { useBroadcastStore } from "@/stores/broadcast-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const positions = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
] as const

export function ReferencePlacement() {
  const theme = useBroadcastStore((s) => s.draftTheme)
  if (!theme) return null
  const placement = theme.reference.standalone
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">Reference position</p>
      <div
        role="group"
        aria-label="Reference position"
        className="grid grid-cols-3 gap-1"
      >
        {positions.map((anchor) => (
          <Button
            key={anchor}
            size="xs"
            variant={placement?.anchor === anchor ? "secondary" : "outline"}
            aria-pressed={placement?.anchor === anchor}
            aria-label={`Reference ${anchor.replaceAll("-", " ")}`}
            onClick={() =>
              useBroadcastStore
                .getState()
                .updateDraftNested("reference.standalone", {
                  anchor,
                  margin: placement?.margin ?? 60,
                })
            }
          >
            {anchor.replaceAll("-", " ")}
          </Button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Fixed to the screen edge. Song titles are hidden.
      </p>
      {!placement && (
        <p className="text-[11px] text-muted-foreground">
          This saved theme uses legacy verse-relative placement. Choose a
          position to fix it to the screen.
        </p>
      )}
      <label className="flex items-center justify-between gap-2 text-xs">
        Edge margin
        <Input
          aria-label="Reference edge margin"
          className="w-20"
          type="number"
          min={0}
          max={500}
          disabled={!placement}
          value={placement?.margin ?? 60}
          onChange={(e) =>
            useBroadcastStore
              .getState()
              .updateDraftNested(
                "reference.standalone.margin",
                Math.min(500, Math.max(0, Number(e.target.value)))
              )
          }
        />
      </label>
    </div>
  )
}
