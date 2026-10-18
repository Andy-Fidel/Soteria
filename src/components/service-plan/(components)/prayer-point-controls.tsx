import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { prayerImageSlide } from "../(lib)/prayer-slide"
import { markPlanItemPresented } from "../(lib)/presentation"

export function PrayerPointControls({ itemId }: { itemId: number }) {
  const prayer = useBroadcastStore((s) => s.fullscreenImage?.prayer)
  if (!prayer || prayer.planItemId !== itemId) return null
  const move = (offset: number) => {
    const index = prayer.index + offset
    if (index < 0 || index >= prayer.content.points.length) return
    useBroadcastStore.getState().setFullscreenImage(prayerImageSlide(itemId, prayer.content, index))
    markPlanItemPresented(itemId)
  }
  return (
    <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
      <Button variant="outline" size="icon-xs" aria-label="Previous prayer point" disabled={prayer.index === 0} onClick={() => move(-1)}><ChevronLeftIcon className="size-3.5" /></Button>
      <span className="text-xs tabular-nums">Point {prayer.index + 1} / {prayer.content.points.length}</span>
      <Button variant="outline" size="icon-xs" aria-label="Next prayer point" disabled={prayer.index === prayer.content.points.length - 1} onClick={() => move(1)}><ChevronRightIcon className="size-3.5" /></Button>
    </div>
  )
}
