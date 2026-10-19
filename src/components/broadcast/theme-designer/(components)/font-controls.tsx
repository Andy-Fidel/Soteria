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
import { useState } from "react"
import { opaqueTextColor } from "@/lib/opaque-text-color"
import { parseColorOpacity, buildColorWithOpacity } from "@/lib/color-value"
const FONT_FAMILIES = [
  "Inter Variable",
  "Geist Variable",
  "Source Serif 4 Variable",
  "Georgia",
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Courier New",
]

const FONT_WEIGHTS = [
  { value: "100", label: "100 - Thin" },
  { value: "200", label: "200 - Extra Light" },
  { value: "300", label: "300 - Light" },
  { value: "400", label: "400 - Regular" },
  { value: "500", label: "500 - Medium" },
  { value: "600", label: "600 - Semi Bold" },
  { value: "700", label: "700 - Bold" },
  { value: "800", label: "800 - Extra Bold" },
  { value: "900", label: "900 - Black" },
]

const HORIZONTAL_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
  { value: "justify", label: "Justify" },
] as const

const VERTICAL_ALIGN_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "middle", label: "Middle" },
  { value: "bottom", label: "Bottom" },
] as const

const TEXT_TRANSFORM_OPTIONS = [
  { value: "none", label: "None" },
  { value: "uppercase", label: "Uppercase" },
  { value: "lowercase", label: "Lowercase" },
  { value: "capitalize", label: "Capitalize" },
] as const

const TEXT_DECORATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "underline", label: "Underline" },
  { value: "line-through", label: "Line Through" },
] as const

export function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border pb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-1"
      >
        <h4 className="text-xs font-bold text-foreground">{title}</h4>
        <span
          className={`text-[10px] text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        >
          ▼
        </span>
      </button>
      {open && <div className="flex flex-col gap-2 pt-1">{children}</div>}
    </div>
  )
}

export function FontControls({
  prefix,
}: {
  prefix: "verseText" | "reference"
}) {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)

  if (!draftTheme) return null

  const data =
    prefix === "verseText" ? draftTheme.verseText : draftTheme.reference
  const { hex: colorHex, opacity: colorOpacity } = parseColorOpacity(
    prefix === "reference" ? opaqueTextColor(data.color) : data.color
  )

  return (
    <div className="flex flex-col gap-1.5">
      {/* Font Family + Font Weight — side by side */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Font
          </label>
          <Select
            value={data.fontFamily}
            onValueChange={(v) => update(`${prefix}.fontFamily`, v)}
          >
            <SelectTrigger aria-label="Font" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Weight
          </label>
          <Select
            value={String(data.fontWeight)}
            onValueChange={(v) => update(`${prefix}.fontWeight`, Number(v))}
          >
            <SelectTrigger aria-label="Weight" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Font Size */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Font Size
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {data.fontSize}px
          </span>
        </div>
        <Slider
          aria-label="Font Size"
          min={8}
          max={200}
          step={1}
          value={[data.fontSize]}
          onValueChange={([v]) => update(`${prefix}.fontSize`, v)}
        />
      </div>

      {/* Line Height — only for verse text, reference type doesn't have lineHeight */}
      {prefix === "verseText" && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Line Height
            </label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {draftTheme.verseText.lineHeight.toFixed(2)}
            </span>
          </div>
          <Slider
            aria-label="Line Height"
            min={0.5}
            max={3.0}
            step={0.05}
            value={[draftTheme.verseText.lineHeight]}
            onValueChange={([v]) => update("verseText.lineHeight", v)}
          />
        </div>
      )}

      {/* Letter Spacing */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Letter Spacing
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {data.letterSpacing}px
          </span>
        </div>
        <Slider
          aria-label="Letter Spacing"
          min={-5}
          max={50}
          step={0.5}
          value={[data.letterSpacing]}
          onValueChange={([v]) => update(`${prefix}.letterSpacing`, v)}
        />
      </div>

      <TextAlignmentControls prefix={prefix} />

      {/* Text Color — compact: swatch + hex + opacity on one row */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input
            aria-label="Text color"
            type="color"
            value={colorHex}
            onChange={(e) =>
              update(
                `${prefix}.color`,
                buildColorWithOpacity(e.target.value, colorOpacity)
              )
            }
            className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
          />
          <ColorValueInput
            aria-label="Text color hex"
            value={colorHex}
            onValueChange={(v) => {
              update(`${prefix}.color`, buildColorWithOpacity(v, colorOpacity))
            }}
            className="w-[72px] font-mono"
          />
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {colorOpacity}%
          </span>
        </div>
        {prefix !== "reference" && (
          <Slider
            aria-label="Text Decoration"
            min={0}
            max={100}
            step={1}
            value={[colorOpacity]}
            onValueChange={([v]) =>
              update(`${prefix}.color`, buildColorWithOpacity(colorHex, v))
            }
          />
        )}
      </div>
    </div>
  )
}

function TextAlignmentControls({
  prefix,
}: {
  prefix: "verseText" | "reference"
}) {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)
  if (!draftTheme) return null
  const data =
    prefix === "verseText" ? draftTheme.verseText : draftTheme.reference
  const horizontalAlign = data.horizontalAlign ?? draftTheme.layout.textAlign
  const verticalAlign = data.verticalAlign ?? "top"
  const textTransform =
    data.textTransform ??
    (prefix === "reference" && draftTheme.reference.uppercase
      ? "uppercase"
      : "none")
  const textDecoration = data.textDecoration ?? "none"
  return (
    <>
      {/* Horizontal Alignment + Vertical Alignment — side by side */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Horizontal Alignment
          </label>
          <Select
            value={horizontalAlign}
            disabled={
              prefix === "reference" && Boolean(draftTheme.reference.standalone)
            }
            onValueChange={(v) => update(`${prefix}.horizontalAlign`, v)}
          >
            <SelectTrigger aria-label="Horizontal Alignment" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HORIZONTAL_ALIGN_OPTIONS.filter(
                (option) => prefix === "verseText" || option.value !== "justify"
              ).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Vertical Alignment
          </label>
          <Select
            value={verticalAlign}
            disabled={
              prefix === "reference" && Boolean(draftTheme.reference.standalone)
            }
            onValueChange={(v) =>
              useBroadcastStore.getState().updateDraft({
                verseText: {
                  ...draftTheme.verseText,
                  verticalAlign: v as "top" | "middle" | "bottom",
                },
                reference: {
                  ...draftTheme.reference,
                  verticalAlign: v as "top" | "middle" | "bottom",
                },
              })
            }
          >
            <SelectTrigger aria-label="Vertical Alignment" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VERTICAL_ALIGN_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Text Transform + Text Decoration — side by side */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Text Transform
          </label>
          <Select
            value={textTransform}
            onValueChange={(v) => {
              if (prefix === "reference")
                useBroadcastStore.getState().updateDraft({
                  reference: {
                    ...draftTheme.reference,
                    textTransform: v as
                      | "none"
                      | "uppercase"
                      | "lowercase"
                      | "capitalize",
                    uppercase: false,
                  },
                })
              else update("verseText.textTransform", v)
            }}
          >
            <SelectTrigger aria-label="Text Transform" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_TRANSFORM_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Text Decoration
          </label>
          <Select
            value={textDecoration}
            onValueChange={(v) => update(`${prefix}.textDecoration`, v)}
          >
            <SelectTrigger aria-label="Text Decoration" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_DECORATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  )
}
