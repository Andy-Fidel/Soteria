// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({
  brand: { churchName: "Example Church", campusName: "North" },
  persist: vi.fn(),
}))
vi.mock("@/stores/settings-store", () => ({
  useSettingsStore: (select: (s: unknown) => unknown) =>
    select({ brand: state.brand }),
  persistBrandConfig: state.persist,
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { ChurchProfileFields } from "./church-profile-fields"
it("saves only this section's trimmed fields and keeps other profile settings", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  state.persist.mockResolvedValue(true)
  const host = document.createElement("div"),
    root = createRoot(host)
  try {
    await act(async () =>
      root.render(
        <ChurchProfileFields
          fields={[{ key: "churchName", label: "Church name" }]}
        />
      )
    )
    const input = host.querySelector("input")!
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!.call(input, "  New Church  ")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => host.querySelector("button")!.click())
    expect(state.persist).toHaveBeenCalledWith({ churchName: "New Church" })
    expect(input.value).toBe("New Church")
  } finally {
    await act(async () => root.unmount())
  }
})
