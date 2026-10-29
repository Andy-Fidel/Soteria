import { beforeEach, expect, it, vi } from "vitest"
const disk = vi.hoisted(() => new Map<string, unknown>())
const save = vi.hoisted(() => vi.fn())
vi.mock("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async (key: string) => disk.get(key),
    set: save,
      save: async () => {},
  }),
}))
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue("whisper"),
}))
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn().mockResolvedValue(undefined),
}))
beforeEach(() => {
  disk.clear()
  vi.resetModules()
  save.mockReset()
  save.mockImplementation(async (key: string, value: unknown) => {
    disk.set(key, value)
  })
})
it("persists local speech and restores it on restart", async () => {
  const { persistSttProvider, useSettingsStore, hydrateSettings } =
    await import("./settings-store")
  expect(await persistSttProvider("whisper")).toBe(true)
  useSettingsStore.getState().setSttProvider("deepgram")
  await hydrateSettings()
  expect(useSettingsStore.getState().sttProvider).toBe("whisper")
})
it("does not claim the offline provider was saved when storage fails", async () => {
  const { persistSttProvider, useSettingsStore } =
    await import("./settings-store")
  useSettingsStore.getState().setSttProvider("deepgram")
  save.mockRejectedValueOnce(new Error("Read-only storage"))
  expect(await persistSttProvider("whisper")).toBe(false)
  expect(useSettingsStore.getState().sttProvider).toBe("deepgram")
})
