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
  useSettingsStore.getState().setBrand({
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

it("keeps giving details after reload without restoring the EWC payment image", async () => {
  disk.set("brand", { churchName: "Existing church" })
  const { useSettingsStore, persistBrandConfig, hydrateSettings } =
    await import("./settings-store")
  await hydrateSettings()
  expect(useSettingsStore.getState().brand.momoImagePath).toBe(
    "/service-slides/momo.png"
  )
  expect(
    await persistBrandConfig({
      momoImagePath: null,
      givingNumber: "0123456789",
      givingAccountName: "Example Church",
    })
  ).toBe(true)
  await hydrateSettings()
  expect(useSettingsStore.getState().brand).toMatchObject({
    momoImagePath: null,
    givingNumber: "0123456789",
    givingAccountName: "Example Church",
  })
})
it("serializes separate profile edits without dropping either field", async () => {
  const { persistBrandConfig, hydrateSettings, useSettingsStore } =
    await import("./settings-store")
  await Promise.all([
    persistBrandConfig({ churchName: "Example Church" }),
    persistBrandConfig({ givingNumber: "0123456789" }),
  ])
  await hydrateSettings()
  expect(useSettingsStore.getState().brand).toMatchObject({
    churchName: "Example Church",
    givingNumber: "0123456789",
  })
})
