import { useBroadcastStore } from "@/stores/broadcast-store"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ColorValueInput } from "./color-value-input"
import { CollapsibleSection } from "./font-controls"
export function DividerProperties() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)
  if (!draftTheme) return null
  return (
    <>
      {/* Divider */}
      <CollapsibleSection title="Divider" defaultOpen={false}>
        <Select
          value={draftTheme.divider?.style ?? "none"}
          onValueChange={(v) => {
            if (
              v !== "none" &&
              (!draftTheme.divider || !draftTheme.divider.color)
            ) {
              update("divider", {
                style: v,
                color: "#ffffff",
                width: 60,
                opacity: 0.5,
                dotCount: 4,
                dotSize: 4,
              })
            } else {
              update("divider.style", v)
            }
          }}
        >
          <SelectTrigger aria-label="Divider style" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="line">Line</SelectItem>
            <SelectItem value="dots">Dots</SelectItem>
          </SelectContent>
        </Select>

        {draftTheme.divider?.style && draftTheme.divider.style !== "none" && (
          <div className="flex flex-col gap-2">
            {/* Divider Color — compact */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  aria-label="Divider color"
                  type="color"
                  value={draftTheme.divider.color ?? "#ffffff"}
                  onChange={(e) => update("divider.color", e.target.value)}
                  className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <ColorValueInput
                  aria-label="Divider color hex"
                  value={draftTheme.divider.color ?? "#ffffff"}
                  onValueChange={(value) => update("divider.color", value)}
                  className="w-[72px] font-mono"
                />
              </div>
            </div>

            {/* Divider Width */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Width
                </label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {draftTheme.divider.width ?? 60}px
                </span>
              </div>
              <Slider
                aria-label="Width"
                min={10}
                max={200}
                step={5}
                value={[draftTheme.divider.width ?? 60]}
                onValueChange={([v]) => update("divider.width", v)}
              />
            </div>

            {/* Divider Opacity */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Opacity
                </label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {Math.round((draftTheme.divider.opacity ?? 0.5) * 100)}%
                </span>
              </div>
              <Slider
                aria-label="Opacity"
                min={0}
                max={1}
                step={0.05}
                value={[draftTheme.divider.opacity ?? 0.5]}
                onValueChange={([v]) => update("divider.opacity", v)}
              />
            </div>

            {/* Dot-specific controls */}
            {draftTheme.divider.style === "dots" && (
              <>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">
                      Dot Count
                    </label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {draftTheme.divider.dotCount ?? 4}
                    </span>
                  </div>
                  <Slider
                    aria-label="Dot Count"
                    min={2}
                    max={8}
                    step={1}
                    value={[draftTheme.divider.dotCount ?? 4]}
                    onValueChange={([v]) => update("divider.dotCount", v)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">
                      Dot Size
                    </label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {draftTheme.divider.dotSize ?? 4}px
                    </span>
                  </div>
                  <Slider
                    aria-label="Dot Size"
                    min={2}
                    max={10}
                    step={1}
                    value={[draftTheme.divider.dotSize ?? 4]}
                    onValueChange={([v]) => update("divider.dotSize", v)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </CollapsibleSection>
    </>
  )
}
