import { beforeEach, describe, expect, it, vi } from "vitest"
import { parsePlanItem, type PlanItem, type PrayerSlideContent } from "@/types"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { PRAYER_SLIDE, prayerImageSlide, savePrayerSlide } from "./prayer-slide"

const { invokeMock, emitMock } = vi.hoisted(() => ({ invokeMock: vi.fn(), emitMock: vi.fn() }))
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock, convertFileSrc: (path: string) => path }))
vi.mock("@tauri-apps/api/event", () => ({ emit: emitMock }))
const item: PlanItem = { id: 1, planId: 10, planKind: "session", orderIndex: 1, itemType: "blank", itemData: JSON.stringify(PRAYER_SLIDE), autoAdvanceSeconds: null }
const content: PrayerSlideContent = { background: "hands", points: ["Thank God for His faithfulness.", "Pray for our families."] }

beforeEach(() => {
  invokeMock.mockReset().mockResolvedValue(undefined)
  emitMock.mockReset().mockResolvedValue(undefined)
  useServicePlanStore.getState().setPlan({ planId: 10, planKind: "session", items: [item] })
  useBroadcastStore.setState({ fullscreenImage: null, liveVerse: null, isLive: false })
})

describe("prayer slides", () => {
  it("preserves all points and their order through persistence", async () => {
    await savePrayerSlide(item, content)
    const saved = useServicePlanStore.getState().plan!.items[0]
    expect(parsePlanItem(saved)).toMatchObject({ prayer: content })
    expect(invokeMock).toHaveBeenCalledWith("plan_update_item", expect.objectContaining({ itemId: 1, itemData: saved.itemData }))
    expect(emitMock).not.toHaveBeenCalled()
    expect(useBroadcastStore.getState().fullscreenImage).toBeNull()
  })

  it("does not change a live slide when edits are applied", async () => {
    const live = prayerImageSlide(item.id, content, 1)
    useBroadcastStore.setState({ fullscreenImage: live, isLive: true })
    await savePrayerSlide(item, { background: "cross-light", points: ["A newly prepared point."] })
    expect(useBroadcastStore.getState().fullscreenImage).toBe(live)
    expect(emitMock).not.toHaveBeenCalled()
  })

  it("changes the background without losing text or the selected point", () => {
    const hands = prayerImageSlide(1, content, 1)
    const cross = prayerImageSlide(1, { ...content, background: "cross-light" }, 1)
    expect(cross.url).not.toBe(hands.url)
    expect(cross.textOverlay).toEqual(hands.textOverlay)
    expect(cross.prayer?.content.points).toEqual(content.points)
    expect(prayerImageSlide(1, content, -1).prayer?.index).toBe(0)
    expect(prayerImageSlide(1, content, 99).prayer?.index).toBe(1)
  })

  it.each([{ points: [] }, { points: ["   "] }, { points: ["x".repeat(301)] }])("rejects invalid points before saving: %j", async ({ points }) => {
    await expect(savePrayerSlide(item, { ...content, points })).rejects.toThrow()
    expect(invokeMock).not.toHaveBeenCalled()
    expect(parsePlanItem({ ...item, itemData: JSON.stringify({ ...PRAYER_SLIDE, prayer: { ...content, points } }) })).toBeNull()
  })

  it("keeps edits open after a save failure", async () => {
    invokeMock.mockRejectedValueOnce(new Error("Save failed"))
    await expect(savePrayerSlide(item, content)).rejects.toThrow("Save failed")
    expect(useServicePlanStore.getState().plan!.items[0]).toBe(item)
    expect(emitMock).not.toHaveBeenCalled()
  })

  it("does not insert an old-session item into a newly opened plan", async () => {
    invokeMock.mockImplementationOnce(async () => {
      useServicePlanStore.getState().setPlan({ planId: 20, planKind: "session", items: [] })
    })
    await expect(savePrayerSlide(item, content)).rejects.toThrow("original plan")
    expect(useServicePlanStore.getState().plan!.items).toEqual([])
  })
})
