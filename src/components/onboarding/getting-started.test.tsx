// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { beforeEach, expect, it, vi } from "vitest"
const disk = vi.hoisted(() => new Map<string, unknown>())
vi.mock("@tauri-apps/plugin-store", () => ({ load: async () => ({
  get: async (key: string) => disk.get(key),
  set: async (key: string, value: unknown) => disk.set(key, value),
  save: async () => {},
}) }))
vi.mock("@tauri-apps/api/event", () => ({ emit: vi.fn() }))
import { useSettingsStore } from "@/stores/settings-store"
import { GettingStartedDialog } from "./(modals)/getting-started-dialog"

beforeEach(() => {
  disk.clear()
  useSettingsStore.setState({ settingsHydrated: false, onboardingComplete: false, sttProvider: "whisper" })
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

it("waits for saved settings and does not interrupt an existing completed setup", async () => {
  const host = document.createElement("div")
  const root = createRoot(host)
  await act(async () => root.render(<GettingStartedDialog />))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await act(async () => useSettingsStore.setState({ settingsHydrated: true, onboardingComplete: true }))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await act(async () => root.unmount())
})

it("shows the brief offline guide once and saves its dismissal", async () => {
  useSettingsStore.setState({ settingsHydrated: true })
  const host = document.createElement("div")
  const root = createRoot(host)
  await act(async () => root.render(<GettingStartedDialog />))
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Check offline readiness to verify this installation.")
  const button = Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "Got it")
  await act(async () => button?.click())
  expect(disk.get("onboardingComplete")).toBe(true)
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await act(async () => root.unmount())
})
