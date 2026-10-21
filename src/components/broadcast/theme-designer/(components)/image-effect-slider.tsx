import { useState } from "react"
import { Slider } from "@/components/ui/slider"

/** Commit image processing once per gesture, rather than once per pointer event. */
export function ImageEffectSlider({
  label,
  value,
  max,
  onCommit,
  suffix,
}: {
  label: string
  value: number
  max: number
  onCommit: (value: number) => void
  suffix: string
}) {
  const [drag, setDrag] = useState<{ source: number; value: number } | null>(
    null
  )
  const shown = drag?.source === value ? drag.value : value
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {shown}
          {suffix}
        </span>
      </div>
      <Slider
        aria-label={label}
        min={0}
        max={max}
        step={1}
        value={[shown]}
        onValueChange={([next]) => setDrag({ source: value, value: next })}
        onValueCommit={([next]) => {
          onCommit(next)
          setDrag(null)
        }}
      />
    </div>
  )
}
