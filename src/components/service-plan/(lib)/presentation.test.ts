import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { markPlanItemPresented } from "./presentation"
import { activatePlanItem } from "../activation-router"
import type { PlanItem } from "@/types"
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  convertFileSrc: (path: string) => path,
}))
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}))
const first: PlanItem = {
  id: 1,
  planId: 1,
  planKind: "session",
  itemType: "blank",
  itemData: JSON.stringify({ imageUrl: "/first.png" }),
  orderIndex: 1,
  autoAdvanceSeconds: 10,
}
const second: PlanItem = {
  ...first,
  id: 2,
  itemData: JSON.stringify({ imageUrl: "/second.png" }),
  orderIndex: 2,
  autoAdvanceSeconds: null,
}
beforeEach(() => {
  vi.useFakeTimers()
  useServicePlanStore
    .getState()
    .setPlan({ planId: 1, planKind: "session", items: [first, second] })
  useBroadcastStore.setState({ fullscreenImage: null })
})
afterEach(() => {
  useServicePlanStore.getState().cancelPendingAdvance()
  vi.useRealTimers()
})
it("selecting a timed item never arms auto-advance", () => {
  useServicePlanStore.getState().setActiveItem(1)
  vi.advanceTimersByTime(20_000)
  expect(useBroadcastStore.getState().fullscreenImage).toBeNull()
  expect(useServicePlanStore.getState().pendingAdvanceDeadline).toBeNull()
})
it("advances only after presentation and keeps the deadline through unrelated edits", () => {
  activatePlanItem(first)
  expect(useServicePlanStore.getState().pendingAdvanceDeadline).toBe(
    Date.now() + 10_000
  )
  vi.advanceTimersByTime(6_000)
  useServicePlanStore.getState().upsertItem({ ...second, orderIndex: 3 })
  vi.advanceTimersByTime(4_000)
  expect(useBroadcastStore.getState().fullscreenImage?.url).toBe("/second.png")
})
it("removing the presented item cancels its countdown", () => {
  markPlanItemPresented(1)
  expect(useServicePlanStore.getState().pendingAdvanceDeadline).not.toBeNull()
  useServicePlanStore.getState().removeItem(1)
  expect(useServicePlanStore.getState().pendingAdvanceDeadline).toBeNull()
  vi.advanceTimersByTime(20_000)
  expect(useBroadcastStore.getState().fullscreenImage).toBeNull()
})
it("opening an announcement editor does not start a timer", () => {
  const announcement: PlanItem = {
    ...first,
    itemType: "announcement",
    itemData: JSON.stringify({ title: "Review me", body: "", mode: "slide" }),
  }
  useServicePlanStore.getState().upsertItem(announcement)
  activatePlanItem(announcement)
  expect(useServicePlanStore.getState().pendingAdvanceDeadline).toBeNull()
})
it("re-presenting restarts the countdown from that presentation", () => {
  markPlanItemPresented(1)
  vi.advanceTimersByTime(6_000)
  markPlanItemPresented(1)
  vi.advanceTimersByTime(4_000)
  expect(useBroadcastStore.getState().fullscreenImage).toBeNull()
  vi.advanceTimersByTime(6_000)
  expect(useBroadcastStore.getState().fullscreenImage?.url).toBe("/second.png")
})
it.each(["scripture", "image", "blank", "hide", "kill"])(
  "cancels auto-advance when %s takes over the output",
  (action) => {
    activatePlanItem(first)
    const broadcast = useBroadcastStore.getState()
    if (action === "scripture")
      broadcast.setLiveVerse({
        reference: "John 3:16",
        segments: [{ text: "new content", verseNumber: 16 }],
      })
    if (action === "image")
      broadcast.setFullscreenImage({ url: "/other.png", label: "Other" })
    if (action === "blank") broadcast.setBlankLogo(true)
    if (action === "hide") broadcast.setLive(false)
    if (action === "kill") broadcast.clearScreen()
    expect(useServicePlanStore.getState().pendingAdvanceDeadline).toBeNull()
    vi.advanceTimersByTime(20_000)
    expect(useBroadcastStore.getState().fullscreenImage?.url).not.toBe(
      "/second.png"
    )
    if (action === "hide")
      expect(useBroadcastStore.getState().outputHidden).toBe(true)
  }
)
