import { beforeEach, expect, it, vi } from "vitest"
import { handlePlanKeyDown } from "./keyboard"
import { useServicePlanStore } from "@/stores/service-plan-store"
vi.mock("../activation-router", () => ({ activatePlanItem: vi.fn() }))
import { activatePlanItem } from "../activation-router"
const blank = (id: number) => ({
  id,
  planId: 1,
  planKind: "session" as const,
  itemType: "blank" as const,
  itemData: "{}",
  orderIndex: id,
  autoAdvanceSeconds: null,
})
beforeEach(() => {
  vi.mocked(activatePlanItem).mockClear()
  useServicePlanStore
    .getState()
    .setPlan({ planId: 1, planKind: "session", items: [blank(1), blank(2)] })
  useServicePlanStore.getState().setActiveItem(1)
})
function key({
  inside = true,
  interactive = false,
  dialog = false,
  key = "Enter",
} = {}) {
  const target = {
    closest: () => (interactive ? {} : null),
    ownerDocument: { querySelector: () => (dialog ? {} : null) },
  }
  return {
    key,
    target,
    currentTarget: { contains: () => inside },
    defaultPrevented: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLDivElement>
}
it.each([{ inside: false }, { interactive: true }, { dialog: true }])(
  "does not present from an unrelated control: %j",
  (options) => {
    handlePlanKeyDown(key(options))
    expect(activatePlanItem).not.toHaveBeenCalled()
  }
)
it("lets Enter present the selected row when focus is in the plan", () => {
  handlePlanKeyDown(key())
  expect(activatePlanItem).toHaveBeenCalledWith(
    expect.objectContaining({ id: 1 })
  )
})
it("arrow keys select without presenting", () => {
  handlePlanKeyDown(key({ key: "ArrowDown" }))
  expect(useServicePlanStore.getState().activeItemId).toBe(2)
  expect(activatePlanItem).not.toHaveBeenCalled()
})
