import { invoke } from "@tauri-apps/api/core"
import type { ImageSlide, PlanItem, PlanItemBlank, PrayerSlideContent } from "@/types"
import { useServicePlanStore } from "@/stores/service-plan-store"

export const PRAYER_BACKGROUNDS = [
  { id: "hands", label: "Praying Hands", url: "/service-slides/prayer-hands.png" },
  { id: "cross-light", label: "Cross & Light", url: "/service-slides/prayer-cross-light.png" },
] as const

export const PRAYER_SLIDE: PlanItemBlank = {
  type: "blank", showLogo: false, imageLabel: "Prayer",
  imageUrl: PRAYER_BACKGROUNDS[0].url,
  prayer: { background: "hands", points: ["LET US PRAY"] },
}

export function prayerImageSlide(planItemId: number, content: PrayerSlideContent, index = 0): ImageSlide {
  const safeIndex = Math.max(0, Math.min(index, content.points.length - 1))
  return {
    url: PRAYER_BACKGROUNDS.find((background) => background.id === content.background)?.url ?? PRAYER_BACKGROUNDS[0].url,
    label: "Prayer",
    textOverlay: { layout: "prayer", title: "PRAYER", body: content.points[safeIndex] ?? "LET US PRAY" },
    prayer: { planItemId, content, index: safeIndex },
  }
}

export async function savePrayerSlide(item: PlanItem, content: PrayerSlideContent): Promise<void> {
  if (!PRAYER_BACKGROUNDS.some((background) => background.id === content.background)) throw new Error("Choose a prayer background.")
  if (content.points.length < 1 || content.points.length > 30 || content.points.some((point) => !point.trim() || point.length > 300)) {
    throw new Error("Add 1–30 prayer points, each with 1–300 characters.")
  }
  const prayer = { ...content, points: content.points.map((point) => point.trim()) }
  const payload: PlanItemBlank = { type: "blank", showLogo: false, imageLabel: "Prayer", imageUrl: prayerImageSlide(item.id, prayer).url, prayer }
  const itemData = JSON.stringify(payload)
  await invoke("plan_update_item", { itemId: item.id, itemData, autoAdvanceSeconds: item.autoAdvanceSeconds })
  const store = useServicePlanStore.getState()
  if (store.plan?.planId !== item.planId || store.plan.planKind !== item.planKind) throw new Error("Saved to the original plan. Open that session to present it.")
  store.upsertItem({ ...item, itemData })
}
