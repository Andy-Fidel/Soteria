// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
const disk = vi.hoisted(() => new Map<string, unknown>())
const sync = vi.hoisted(() => vi.fn())
vi.mock("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async (key: string) => disk.get(key),
    set: async (key: string, value: unknown) => disk.set(key, value),
    save: async () => {},
  }),
}))
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
}))
vi.mock("@tauri-apps/api/event", () => ({ emit: vi.fn() }))
vi.mock("@/stores/broadcast-store", () => ({
  useBroadcastStore: { getState: () => ({ syncBroadcastOutput: sync }) },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { useSettingsStore } from "@/stores/settings-store"
import { loadChurchProfile } from "@/lib/church-profile"
import { GivingDetails } from "./giving-details"
it("preserves the selected image until the user explicitly saves editable details", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const brand = {
    ...loadChurchProfile({}, true),
    givingProvider: "MTN",
    givingNumber: "0123456789",
    givingAccountName: "Example Church",
  }
  useSettingsStore.setState({ brand })
  const container = document.createElement("div")
  const root = createRoot(container)
  try {
    await act(async () => root.render(<GivingDetails />))
    expect(useSettingsStore.getState().brand.momoImagePath).toBe(
      "/service-slides/momo.png"
    )
    expect(container.textContent).toContain("stays unchanged")
    expect(container.querySelector("img")?.src).toContain("data:image/svg+xml")
    await act(async () => container.querySelector("button")!.click())
    expect(useSettingsStore.getState().brand).toMatchObject({
      momoImagePath: null,
      givingNumber: "0123456789",
      givingAccountName: "Example Church",
    })
    expect(disk.get("brand")).toMatchObject({
      momoImagePath: null,
      givingNumber: "0123456789",
    })
    expect(sync).toHaveBeenCalledOnce()
  } finally {
    await act(async () => root.unmount())
  }
})
