import { beforeEach, expect, it, vi } from "vitest"
const disk = vi.hoisted(() => new Map<string, unknown>())
vi.mock("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async (key: string) => disk.get(key),
    set: async (key: string, value: unknown) => {
      disk.set(key, structuredClone(value))
    },
    save: async () => {},
  }),
}))
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}))
beforeEach(() => {
  disk.clear()
  vi.resetModules()
})

it("restores the chosen video and mode after settings are reloaded", async () => {
  const { useSettingsStore, persistBrandConfig, hydrateSettings } =
    await import("./settings-store")
  await persistBrandConfig({
    blankVideoPath: "/managed/worship.mp4",
    blankBackground: "video",
  })
  useSettingsStore
    .getState()
    .setBrand({
      ...useSettingsStore.getState().brand,
      blankVideoPath: null,
      blankBackground: "image",
    })
  await hydrateSettings()
  expect(useSettingsStore.getState().brand).toMatchObject({
    blankVideoPath: "/managed/worship.mp4",
    blankBackground: "video",
  })
})

it("keeps a legacy custom blank image active until the operator chooses video", async () => {
  disk.set("brand", { blankImagePath: "/managed/church.png" })
  const { useSettingsStore, hydrateSettings } = await import("./settings-store")
  await hydrateSettings()
  expect(useSettingsStore.getState().brand).toMatchObject({
    blankImagePath: "/managed/church.png",
    blankBackground: "image",
  })
})
