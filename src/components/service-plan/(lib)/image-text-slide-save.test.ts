import { beforeEach, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { saveImageTextSlide, IMAGE_TEXT_PRESETS } from "./image-text-slide"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useSessionStore } from "@/stores/session-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import type { PlanItem, PlanItemBlank } from "@/types"
vi.mock("@/stores/queue-store", () => ({
  useQueueStore: { getState: () => ({ queue: [] }) },
}))
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  convertFileSrc: (p: string) => p,
}))
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}))
const item: PlanItem = {
  id: 1,
  planId: 1,
  planKind: "session",
  itemType: "blank",
  itemData: "{}",
  orderIndex: 1,
  autoAdvanceSeconds: null,
}
const payload: PlanItemBlank = {
  ...IMAGE_TEXT_PRESETS[0],
  textOverlay: {
    layout: "title",
    title: "Sunday service",
    body: "Pastor Example",
  },
}
beforeEach(() => {
  useSessionStore.setState({
    activeSession: {
      id: 1,
      title: "Service",
      speaker: null,
      date: "2026-10-18",
      seriesName: null,
      tags: [],
      startedAt: null,
      endedAt: null,
      status: "planned",
      plannedScriptures: [],
      summary: null,
      audioPath: null,
      createdAt: "",
      updatedAt: "",
    },
  })
  vi.mocked(invoke).mockReset().mockResolvedValue(undefined)
  useServicePlanStore
    .getState()
    .setPlan({ planId: 1, planKind: "session", items: [item] })
  useBroadcastStore.setState({ fullscreenImage: null })
})
it("saves editable words but does not send Save-only edits live", async () => {
  await saveImageTextSlide(item, payload, null, false)
  expect(
    JSON.parse(useServicePlanStore.getState().plan!.items[0].itemData)
      .textOverlay
  ).toEqual(payload.textOverlay)
  expect(useBroadcastStore.getState().fullscreenImage).toBeNull()
  expect(invoke).toHaveBeenCalledWith(
    "plan_update_item",
    expect.objectContaining({ itemId: 1, itemData: JSON.stringify(payload) })
  )
})
it("saves before presenting the selected background and text", async () => {
  await saveImageTextSlide(item, payload, null, true)
  expect(useBroadcastStore.getState().fullscreenImage).toMatchObject({
    url: payload.imageUrl,
    textOverlay: payload.textOverlay,
  })
})
it("preserves existing output and plan when saving fails", async () => {
  vi.mocked(invoke).mockRejectedValue(new Error("Save failed"))
  await expect(saveImageTextSlide(item, payload, null, true)).rejects.toThrow(
    "Save failed"
  )
  expect(useServicePlanStore.getState().plan!.items[0].itemData).toBe("{}")
  expect(useBroadcastStore.getState().fullscreenImage).toBeNull()
})
it("does not present or insert old-session slides after switching sessions during save", async () => {
  vi.mocked(invoke).mockImplementation(async () => {
    useServicePlanStore
      .getState()
      .setPlan({ planId: 2, planKind: "session", items: [] })
  })
  await expect(saveImageTextSlide(item, payload, null, true)).rejects.toThrow(
    "session changed"
  )
  expect(useServicePlanStore.getState().plan!.items).toEqual([])
  expect(useBroadcastStore.getState().fullscreenImage).toBeNull()
})
it("rejects an empty title before changing the saved plan", async () => {
  await expect(
    saveImageTextSlide(
      item,
      { ...payload, textOverlay: { ...payload.textOverlay!, title: "  " } },
      null,
      true
    )
  ).rejects.toThrow("Add a title")
  expect(invoke).not.toHaveBeenCalled()
})

it("does not present when active session changes before its old plan clears", async () => {
  vi.mocked(invoke).mockImplementation(async () => {
    useSessionStore.getState().updateActiveSession({ id: 2 })
  })
  await expect(saveImageTextSlide(item, payload, null, true)).rejects.toThrow(
    "session changed"
  )
  expect(useServicePlanStore.getState().plan!.items[0].itemData).toBe("{}")
  expect(useBroadcastStore.getState().fullscreenImage).toBeNull()
})
it("rejects stale session edits before saving", async () => {
  useSessionStore.getState().updateActiveSession({ id: 2 })
  await expect(saveImageTextSlide(item, payload, null, true)).rejects.toThrow(
    "session changed"
  )
  expect(invoke).not.toHaveBeenCalled()
})
