import { DEFAULT_SPEAKER_NAME } from "@/lib/speaker-portrait"
import { invoke } from "@tauri-apps/api/core"
import type { PlanItem, PlanItemBlank } from "@/types"
import { useSessionStore } from "@/stores/session-store"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { activatePlanItem } from "../activation-router"

export const STARBURST_BACKGROUND = "/service-slides/starburst-black.png"
export const IMAGE_TEXT_PRESETS: PlanItemBlank[] = [
  "title",
  "announcement",
].map((layout) => ({
  type: "blank",
  showLogo: false,
  imageUrl: STARBURST_BACKGROUND,
  imageLabel: layout === "title" ? "Service title" : "Announcement",
  textOverlay: {
    layout: layout as "title" | "announcement",
    title: "",
    body: layout === "title" ? DEFAULT_SPEAKER_NAME : "",
  },
}))

function isCurrentPlan(item: PlanItem) {
  const plan = useServicePlanStore.getState().plan
  return (
    plan?.planId === item.planId &&
    plan.planKind === item.planKind &&
    (item.planKind !== "session" ||
      useSessionStore.getState().activeSession?.id === item.planId)
  )
}

export async function saveImageTextSlide(
  item: PlanItem,
  payload: PlanItemBlank,
  seconds: number | null,
  goLive: boolean
) {
  if (!payload.imageUrl || !payload.textOverlay?.title.trim())
    throw new Error("Add a title and a background image.")
  if (!isCurrentPlan(item))
    throw new Error(
      "The session changed. Reopen the slide in the current plan."
    )
  const itemData = JSON.stringify(payload)
  await invoke("plan_update_item", {
    itemId: item.id,
    itemData,
    autoAdvanceSeconds: seconds,
  })
  const current = useServicePlanStore.getState()
  if (!isCurrentPlan(item)) {
    throw new Error(
      "Saved to the original plan. The session changed, so the slide was not presented."
    )
  }
  const saved = { ...item, itemData, autoAdvanceSeconds: seconds }
  current.upsertItem(saved)
  if (goLive) activatePlanItem(saved)
}
