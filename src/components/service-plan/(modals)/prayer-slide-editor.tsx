import { useState } from "react"
import { PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer"
import { useBroadcastStore } from "@/stores/broadcast-store"
import type { PlanItem, PrayerSlideContent } from "@/types"
import { PRAYER_BACKGROUNDS, prayerImageSlide, savePrayerSlide } from "../(lib)/prayer-slide"

export function PrayerSlideEditor({ item, content, onClose }: {
  item: PlanItem
  content: PrayerSlideContent
  onClose: () => void
}) {
  const [background, setBackground] = useState(content.background)
  const [points, setPoints] = useState(content.points)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const theme = useBroadcastStore((s) => s.themes.find((theme) => theme.id === s.activeThemeId) ?? s.themes[0])
  const valid = points.length > 0 && points.every((point) => point.trim() && point.length <= 300)
  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      await savePrayerSlide(item, { background, points })
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
      <DrawerContent className="left-1/2 right-auto max-h-[90vh] w-full max-w-3xl -translate-x-1/2">
        <DrawerHeader>
          <DrawerTitle>Edit prayer slide</DrawerTitle>
          <DrawerDescription>Show one point at a time. Apply saves your changes; present the item from the plan when ready.</DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-5 px-4 pb-4 md:grid-cols-2">
          <div className="flex flex-col gap-4">
            <fieldset disabled={saving} className="flex flex-col gap-2">
              <legend className="mb-2 text-xs font-medium">Background</legend>
              <div className="grid grid-cols-2 gap-2">
                {PRAYER_BACKGROUNDS.map((option) => (
                  <button key={option.id} type="button" aria-pressed={background === option.id} onClick={() => setBackground(option.id)} className={`overflow-hidden rounded-md border text-left focus-visible:outline-2 focus-visible:outline-ring ${background === option.id ? "ring-2 ring-primary" : ""}`}>
                    <img src={option.url} alt="" className="aspect-video w-full bg-black object-cover" />
                    <span className="block p-2 text-xs">{option.label}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            {points.map((point, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor={`prayer-point-${index}`} className="text-xs font-medium">Prayer point {index + 1}</label>
                  <Button variant="ghost" size="icon-xs" aria-label={`Remove prayer point ${index + 1}`} disabled={saving || points.length === 1} onClick={() => {
                    setPoints(points.filter((_, i) => i !== index))
                    setPreviewIndex(0)
                  }}><Trash2Icon className="size-3.5" /></Button>
                </div>
                <Textarea id={`prayer-point-${index}`} value={point} maxLength={300} rows={3} disabled={saving} onFocus={() => setPreviewIndex(index)} onChange={(event) => setPoints(points.map((value, i) => i === index ? event.target.value : value))} placeholder="Type a prayer point…" />
                <span className="text-right text-[10px] text-muted-foreground">{point.length}/300</span>
              </div>
            ))}
            <Button variant="outline" size="sm" disabled={saving || points.length >= 30} onClick={() => {
              setPreviewIndex(points.length)
              setPoints([...points, ""])
            }}><PlusIcon className="size-3.5" /> Add point</Button>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">Preview — point {previewIndex + 1}</span>
            <div className="overflow-hidden rounded-md border bg-black">
              <CanvasVerse theme={theme} verse={null} fullscreenImage={prayerImageSlide(item.id, { background, points }, previewIndex)} />
            </div>
            <p className="text-xs text-muted-foreground">Keep each point short for clear projection. Changing backgrounds keeps your text.</p>
          </div>
        </div>
        <DrawerFooter className="flex flex-row justify-end gap-2">
          <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button disabled={saving || !valid} onClick={() => void save()}>{saving ? "Saving…" : "Apply"}</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
