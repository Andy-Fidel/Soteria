import { ReferencePlacement } from "./theme-designer/(components)/reference-placement"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { TextEffects } from "./theme-designer/(components)/text-effects"
import { DividerProperties } from "./theme-designer/(components)/divider-properties"
import {
  FontControls,
  CollapsibleSection,
} from "./theme-designer/(components)/font-controls"
function ReferenceProperties() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)

  if (!draftTheme) return null

  return (
    <div className="flex flex-col gap-2">
      <CollapsibleSection title="Reference Text">
        <FontControls prefix="reference" />

        <ReferencePlacement />
      </CollapsibleSection>
    </div>
  )
}

function VerseProperties() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)

  if (!draftTheme) return null

  return (
    <div className="flex flex-col gap-2">
      <CollapsibleSection title="Verse Text">
        <FontControls prefix="verseText" />
      </CollapsibleSection>

      <TextEffects />
      {/* Line Break Mode */}
      <CollapsibleSection title="Line Break Mode" defaultOpen={false}>
        <Select
          value={draftTheme.verseText.lineBreakMode ?? "flow"}
          onValueChange={(v) => update("verseText.lineBreakMode", v)}
        >
          <SelectTrigger aria-label="Width" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flow">Flow (paragraph)</SelectItem>
            <SelectItem value="centered-lines">
              Centered Lines (one phrase per line)
            </SelectItem>
          </SelectContent>
        </Select>
      </CollapsibleSection>

      {/* Auto-Fit */}
      <CollapsibleSection title="Auto-Fit Long Verses" defaultOpen={false}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Enabled
          </label>
          <Switch
            aria-label="Enabled"
            checked={draftTheme.verseText.autoFit ?? false}
            onCheckedChange={(checked) => update("verseText.autoFit", checked)}
          />
        </div>
        {draftTheme.verseText.autoFit && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Min Size
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {draftTheme.verseText.minFontSize ?? 24}px
              </span>
            </div>
            <Slider
              aria-label="Min Size"
              min={8}
              max={Math.max(8, Math.min(80, draftTheme.verseText.fontSize))}
              step={1}
              value={[draftTheme.verseText.minFontSize ?? 24]}
              onValueChange={([v]) => update("verseText.minFontSize", v)}
            />
          </div>
        )}
      </CollapsibleSection>

      <DividerProperties />
    </div>
  )
}

export function TextProperties() {
  const selectedElement = useBroadcastStore((s) => s.selectedElement)

  const setSelected = (el: "verse" | "reference") =>
    useBroadcastStore.getState().setSelectedElement(el)

  const target = selectedElement

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant={target === "verse" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelected("verse")}
          className="rounded-full"
        >
          Verse
        </Button>
        <Button
          variant={target === "reference" ? "default" : "outline"}
          size="sm"
          onClick={() => setSelected("reference")}
          className="rounded-full"
        >
          Reference
        </Button>
      </div>
      {target === "reference" ? (
        <ReferenceProperties />
      ) : target === "verse" ? (
        <VerseProperties />
      ) : (
        <p className="text-xs text-muted-foreground">
          Select Verse or Reference to edit its text.
        </p>
      )}
    </div>
  )
}
