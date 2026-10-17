import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import {
  useSettingsStore,
  persistAutoMode,
  persistConfidenceThreshold,
  persistAutoSplitLongVerses,
  persistSplitWordThreshold,
} from "@/stores"

export function DisplayModeSection() {
  const {
    autoMode,
    confidenceThreshold,
    autoSplitLongVerses,
    splitWordThreshold,
  } = useSettingsStore()

  const thresholdPercent = Math.round(confidenceThreshold * 100)

  return (
    <div className="flex flex-col gap-6">
      {/* Mode selector */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Broadcast Mode
        </label>

        <RadioGroup
          value={autoMode ? "auto" : "manual"}
          onValueChange={(v) => persistAutoMode(v === "auto")}
          className="gap-3"
        >
          {/* Auto mode */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
              !autoMode ? "hover:border-muted-foreground/25" : ""
            }`}
          >
            <RadioGroupItem value="auto" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">Auto</span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Automatically displays the highest-confidence detected verse on
                broadcast output. A 2.5-second cooldown prevents rapid
                flickering. Best for hands-off operation.
              </p>
            </div>
          </label>

          {/* Manual mode */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
              autoMode ? "hover:border-muted-foreground/25" : ""
            }`}
          >
            <RadioGroupItem value="manual" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                Manual
              </span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Nothing goes to broadcast until you explicitly send it. Detected
                verses still appear in the AI Detections panel and queue, but
                you decide which ones to display and when. Best for important
                services.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* Confidence threshold — only when auto */}
      {autoMode && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Confidence Threshold
            </label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {thresholdPercent}%
            </span>
          </div>
          <Slider
            min={35}
            max={100}
            step={1}
            value={[thresholdPercent]}
            onValueChange={([v]) => persistConfidenceThreshold(v / 100)}
          />
          <p className="text-[0.625rem] text-muted-foreground">
            Only verses with confidence above this threshold will be sent to
            broadcast automatically. Higher values reduce false positives.
          </p>
        </div>
      )}

      {/* Long-verse auto-split */}
      <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <label className="text-xs font-medium text-foreground">
              Auto-split long verses
            </label>
            <p className="text-[0.625rem] text-muted-foreground">
              Long verses split into ~25-word chunks at sentence boundaries.
              Each chunk becomes its own queue row.
            </p>
          </div>
          <input
            type="checkbox"
            checked={autoSplitLongVerses}
            onChange={(e) => persistAutoSplitLongVerses(e.target.checked)}
            className="size-4 shrink-0 cursor-pointer"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[0.625rem] text-muted-foreground">
            Split if longer than
          </label>
          <Input
            type="number"
            min={20}
            max={200}
            value={splitWordThreshold}
            disabled={!autoSplitLongVerses}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (Number.isFinite(n)) persistSplitWordThreshold(n)
            }}
            className="h-7 w-16 text-xs"
          />
          <span className="text-[0.625rem] text-muted-foreground">words</span>
        </div>
      </div>
    </div>
  )
}
