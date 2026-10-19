import { ColorValueInput } from "./theme-designer/(components)/color-value-input"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ReferencePlacement } from "./theme-designer/(components)/reference-placement"

const ANCHOR_POSITIONS = [
  ["top-left", "top-center", "top-right"],
  ["center-left", "center", "center-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
] as const

export function LayoutProperties() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)

  if (!draftTheme) return null

  const layout = draftTheme.layout
  const resolution = draftTheme.resolution
  const referenceGap =
    layout.referenceGap ??
    Math.max(16, Math.round(draftTheme.reference.fontSize * 0.5))

  const bgWidthPx = Math.round(
    (layout.backgroundWidth / 100) * resolution.width
  )
  const bgHeightPx = Math.round(
    (layout.backgroundHeight / 100) * resolution.height
  )
  const textWidthPx = Math.round((layout.textAreaWidth / 100) * bgWidthPx)
  const textHeightPx = Math.round((layout.textAreaHeight / 100) * bgHeightPx)

  const verseNumbers = draftTheme.verseNumbers
  const superscriptSizePct = Math.round(
    (verseNumbers.fontSize / draftTheme.verseText.fontSize) * 100
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Layout Region Dimensions */}
      <div className="flex flex-col gap-0.5 pb-1">
        <h4 className="text-xs font-semibold">Layout Region Dimensions</h4>
      </div>

      {/* Width */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Width
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {layout.backgroundWidth}% ({bgWidthPx}px)
          </span>
        </div>
        <Slider
          aria-label="Width"
          min={10}
          max={100}
          step={1}
          value={[layout.backgroundWidth]}
          onValueChange={([v]) => update("layout.backgroundWidth", v)}
        />
      </div>

      {/* Height */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Height
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {layout.backgroundHeight}% ({bgHeightPx}px)
          </span>
        </div>
        <Slider
          aria-label="Height"
          min={10}
          max={100}
          step={1}
          value={[layout.backgroundHeight]}
          onValueChange={([v]) => update("layout.backgroundHeight", v)}
        />
      </div>

      {/* Text Area Dimensions */}
      <div className="flex flex-col gap-0.5 border-t pt-3 pb-1">
        <h4 className="text-xs font-semibold">Text Area Dimensions</h4>
      </div>

      {/* Text Width */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Text Width
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {layout.textAreaWidth}% ({textWidthPx}px)
          </span>
        </div>
        <Slider
          aria-label="Text Width"
          min={10}
          max={100}
          step={1}
          value={[layout.textAreaWidth]}
          onValueChange={([v]) => update("layout.textAreaWidth", v)}
        />
      </div>

      {/* Text Height */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Text Height
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {layout.textAreaHeight}% ({textHeightPx}px)
          </span>
        </div>
        <Slider
          aria-label="Text Height"
          min={10}
          max={100}
          step={1}
          value={[layout.textAreaHeight]}
          onValueChange={([v]) => update("layout.textAreaHeight", v)}
        />
      </div>

      {/* Padding */}
      <div className="flex flex-col gap-0.5 border-t pt-3 pb-1">
        <h4 className="text-xs font-semibold">Padding</h4>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Top
          </label>
          <Input
            aria-label="Top"
            type="number"
            min={0}
            value={layout.padding.top}
            onChange={(e) =>
              update("layout.padding.top", Number(e.target.value))
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Right
          </label>
          <Input
            aria-label="Right"
            type="number"
            min={0}
            value={layout.padding.right}
            onChange={(e) =>
              update("layout.padding.right", Number(e.target.value))
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Bottom
          </label>
          <Input
            aria-label="Bottom"
            type="number"
            min={0}
            value={layout.padding.bottom}
            onChange={(e) =>
              update("layout.padding.bottom", Number(e.target.value))
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Left
          </label>
          <Input
            aria-label="Left"
            type="number"
            min={0}
            value={layout.padding.left}
            onChange={(e) =>
              update("layout.padding.left", Number(e.target.value))
            }
          />
        </div>
      </div>

      {!draftTheme.reference.standalone && (
        <>
          {/* Element Spacing */}
          <div className="flex flex-col gap-0.5 border-t pt-3 pb-1">
            <h4 className="text-xs font-semibold">Element Spacing</h4>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Verse / Reference
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {referenceGap}px
              </span>
            </div>
            <Slider
              aria-label="Verse / Reference"
              min={0}
              max={200}
              step={1}
              value={[referenceGap]}
              onValueChange={([v]) => update("layout.referenceGap", v)}
            />
          </div>
        </>
      )}
      {/* Display Options */}
      <div className="flex flex-col gap-0.5 border-t pt-3 pb-1">
        <h4 className="text-xs font-semibold">Display Options</h4>
      </div>

      <ReferencePlacement />

      {/* Verse Number Superscript */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Verse Number Superscript
        </label>
        <input
          aria-label="Verse Number Superscript"
          type="checkbox"
          checked={verseNumbers.superscript}
          onChange={(e) => update("verseNumbers.superscript", e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
      </div>

      {/* Superscript Size */}
      {verseNumbers.superscript && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Superscript Size
            </label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {superscriptSizePct}%
            </span>
          </div>
          <Slider
            aria-label="Superscript Size"
            min={20}
            max={100}
            step={1}
            value={[superscriptSizePct]}
            onValueChange={([v]) => {
              const newFontSize = Math.round(
                (v / 100) * draftTheme.verseText.fontSize
              )
              update("verseNumbers.fontSize", newFontSize)
            }}
          />
        </div>
      )}

      {/* Verse Numbers Visible */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">
          Verse Numbers Visible
        </label>
        <Switch
          aria-label="Verse Numbers Visible"
          checked={verseNumbers.visible}
          onCheckedChange={(checked) => update("verseNumbers.visible", checked)}
        />
      </div>

      {/* Verse Numbers Color */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">
          Verse Numbers Color
        </label>
        <div className="flex items-center gap-2">
          <input
            aria-label="Verse Numbers Color"
            type="color"
            value={verseNumbers.color}
            onChange={(e) => update("verseNumbers.color", e.target.value)}
            className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
          />
          <ColorValueInput
            aria-label="Verse Numbers Color"
            value={verseNumbers.color}
            onValueChange={(value) => update("verseNumbers.color", value)}
            className="w-[72px] font-mono"
          />
        </div>
      </div>

      {/* Anchor Position */}
      <div className="flex flex-col gap-0.5 border-t pt-3 pb-1">
        <h4 className="text-xs font-semibold">Anchor Position</h4>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {ANCHOR_POSITIONS.flat().map((pos) => (
          <button
            key={pos}
            onClick={() => update("layout.anchor", pos)}
            className={`h-7 rounded border text-[10px] font-medium transition-colors ${
              layout.anchor === pos
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-accent"
            }`}
          >
            {pos.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* Offset X / Y */}
      <div className="flex flex-col gap-0.5 border-t pt-3 pb-1">
        <h4 className="text-xs font-semibold">Offset</h4>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Offset X
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {layout.offsetX}px
          </span>
        </div>
        <Slider
          aria-label="Offset X"
          min={-200}
          max={200}
          step={1}
          value={[layout.offsetX]}
          onValueChange={([v]) => update("layout.offsetX", v)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Offset Y
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {layout.offsetY}px
          </span>
        </div>
        <Slider
          aria-label="Offset Y"
          min={-200}
          max={200}
          step={1}
          value={[layout.offsetY]}
          onValueChange={([v]) => update("layout.offsetY", v)}
        />
      </div>
    </div>
  )
}
