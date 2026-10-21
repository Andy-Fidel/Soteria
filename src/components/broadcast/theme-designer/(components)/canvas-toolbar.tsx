import {
  Grid3X3Icon,
  MaximizeIcon,
  MinusIcon,
  PlusIcon,
  ScanIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { PREVIEW_SAMPLES } from "../(lib)/preview-samples"

interface CanvasToolbarProps {
  sample: string
  onSample: (value: string) => void
  zoom: number
  zoomIn: () => void
  zoomOut: () => void
  fit: () => void
  grid: boolean
  onGrid: () => void
  safeArea: boolean
  onSafeArea: () => void
  selected: "verse" | "reference" | null
}
export function CanvasToolbar(props: CanvasToolbarProps) {
  return (
    <div className="shrink-0 space-y-2 border-b border-white/10 bg-zinc-900 px-3 py-2 text-zinc-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Preview
          <select
            aria-label="Preview content"
            className="rounded-md border border-white/15 bg-zinc-800 px-2 py-1.5 text-xs text-white"
            value={props.sample}
            onChange={(e) => props.onSample(e.target.value)}
          >
            {Object.entries(PREVIEW_SAMPLES).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
        </label>
        <div
          role="group"
          aria-label="Canvas zoom"
          className="flex items-center gap-1 rounded-md border border-white/15 p-0.5"
        >
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Zoom out"
            onClick={props.zoomOut}
          >
            <MinusIcon />
          </Button>
          <span className="min-w-10 text-center text-xs tabular-nums">
            {props.zoom}%
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Zoom in"
            onClick={props.zoomIn}
          >
            <PlusIcon />
          </Button>
          <Button variant="ghost" size="xs" onClick={props.fit}>
            <MaximizeIcon />
            Fit
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Select text to edit"
          className="flex rounded-md border border-white/15 p-0.5"
        >
          {([null, "verse", "reference"] as const).map((value) => (
            <Button
              key={value ?? "none"}
              size="xs"
              variant={props.selected === value ? "secondary" : "ghost"}
              aria-pressed={props.selected === value}
              onClick={() =>
                useBroadcastStore.getState().setSelectedElement(value)
              }
            >
              {value === null
                ? "Deselect"
                : value === "verse"
                  ? "Verse"
                  : "Reference"}
            </Button>
          ))}
        </div>
        <div role="group" aria-label="Canvas guides" className="flex gap-1">
          <Button
            size="xs"
            variant={props.grid ? "secondary" : "outline"}
            aria-label="Show grid"
            aria-pressed={props.grid}
            onClick={props.onGrid}
          >
            <Grid3X3Icon />
            Grid: {props.grid ? "On" : "Off"}
          </Button>
          <Button
            size="xs"
            variant={props.safeArea ? "secondary" : "outline"}
            aria-label="Show safe area guides"
            aria-pressed={props.safeArea}
            onClick={props.onSafeArea}
          >
            <ScanIcon />
            Safe area: {props.safeArea ? "On" : "Off"}
          </Button>
        </div>
      </div>
    </div>
  )
}
