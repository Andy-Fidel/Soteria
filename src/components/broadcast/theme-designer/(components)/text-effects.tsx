import { useBroadcastStore } from "@/stores/broadcast-store"
import { Slider } from "@/components/ui/slider"
import { ColorValueInput } from "./color-value-input"
import { Switch } from "@/components/ui/switch"
import { parseColorOpacity, buildColorWithOpacity } from "@/lib/color-value"
import { CollapsibleSection } from "./font-controls"
export function TextEffects() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)
  if (!draftTheme) return null
  const shadow = draftTheme.verseText.shadow
  const outline = draftTheme.verseText.outline

  const shadowColor = shadow
    ? parseColorOpacity(shadow.color)
    : { hex: "#000000", opacity: 100 }
  const outlineColor = outline
    ? parseColorOpacity(outline.color)
    : { hex: "#000000", opacity: 100 }

  return (
    <>
      {/* Text Shadow */}
      <CollapsibleSection title="Text Shadow" defaultOpen={false}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Enabled
          </label>
          <Switch
            aria-label="Enabled"
            checked={shadow !== null}
            onCheckedChange={(checked) => {
              if (checked) {
                update("verseText.shadow", {
                  color: "#00000080",
                  blur: 4,
                  x: 2,
                  y: 2,
                })
              } else {
                update("verseText.shadow", null)
              }
            }}
          />
        </div>

        {shadow && (
          <div className="flex flex-col gap-2">
            {/* Offset X */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Offset X
                </label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {shadow.x}px
                </span>
              </div>
              <Slider
                aria-label="Offset X"
                min={-20}
                max={50}
                step={1}
                value={[shadow.x]}
                onValueChange={([v]) => update("verseText.shadow.x", v)}
              />
            </div>

            {/* Offset Y */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Offset Y
                </label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {shadow.y}px
                </span>
              </div>
              <Slider
                aria-label="Offset Y"
                min={-20}
                max={50}
                step={1}
                value={[shadow.y]}
                onValueChange={([v]) => update("verseText.shadow.y", v)}
              />
            </div>

            {/* Blur */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Blur
                </label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {shadow.blur}px
                </span>
              </div>
              <Slider
                aria-label="Blur"
                min={0}
                max={50}
                step={1}
                value={[shadow.blur]}
                onValueChange={([v]) => update("verseText.shadow.blur", v)}
              />
            </div>

            {/* Shadow Color — compact */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  aria-label="Text shadow color"
                  type="color"
                  value={shadowColor.hex}
                  onChange={(e) =>
                    update(
                      "verseText.shadow.color",
                      buildColorWithOpacity(e.target.value, shadowColor.opacity)
                    )
                  }
                  className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <ColorValueInput
                  aria-label="Text shadow color hex"
                  value={shadowColor.hex}
                  onValueChange={(v) => {
                    update(
                      "verseText.shadow.color",
                      buildColorWithOpacity(v, shadowColor.opacity)
                    )
                  }}
                  className="w-[72px] font-mono"
                />
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {shadowColor.opacity}%
                </span>
              </div>
              <Slider
                aria-label="Blur"
                min={0}
                max={100}
                step={1}
                value={[shadowColor.opacity]}
                onValueChange={([v]) =>
                  update(
                    "verseText.shadow.color",
                    buildColorWithOpacity(shadowColor.hex, v)
                  )
                }
              />
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Text Outline */}
      <CollapsibleSection title="Text Outline" defaultOpen={false}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Enabled
          </label>
          <Switch
            aria-label="Enabled"
            checked={outline !== null}
            onCheckedChange={(checked) => {
              if (checked) {
                update("verseText.outline", { color: "#000000", width: 1 })
              } else {
                update("verseText.outline", null)
              }
            }}
          />
        </div>

        {outline && (
          <div className="flex flex-col gap-2">
            {/* Width */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Width
                </label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {outline.width}px
                </span>
              </div>
              <Slider
                aria-label="Width"
                min={0}
                max={20}
                step={0.5}
                value={[outline.width]}
                onValueChange={([v]) => update("verseText.outline.width", v)}
              />
            </div>

            {/* Outline Color — compact */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  aria-label="Text outline color"
                  type="color"
                  value={outlineColor.hex}
                  onChange={(e) =>
                    update("verseText.outline.color", e.target.value)
                  }
                  className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
                />
                <ColorValueInput
                  aria-label="Text outline color hex"
                  value={outlineColor.hex}
                  onValueChange={(v) => {
                    update("verseText.outline.color", v)
                  }}
                  className="w-[72px] font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </CollapsibleSection>
    </>
  )
}
