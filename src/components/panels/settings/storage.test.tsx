// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { StoragePanel } from "./storage"

const native = vi.hoisted(() => ({
  invoke: vi.fn(),
  ask: vi.fn(),
  open: vi.fn(),
  error: vi.fn(),
}))
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }))
vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: native.ask,
  open: native.open,
}))
vi.mock("sonner", () => ({
  toast: { error: native.error, success: vi.fn(), warning: vi.fn() },
}))
let root: Root
let container: HTMLDivElement
const location = { path: "/old", defaultPath: "/old", isDefault: true }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
  vi.clearAllMocks()
  native.ask.mockResolvedValue(true)
  native.open.mockResolvedValue("/new")
  native.invoke.mockImplementation(async (command: string) => {
    if (command === "list_sessions")
      return [
        {
          id: 1,
          title: "Finished",
          date: "2026-10-21",
          status: "ended",
          audioPath: "/old/1/audio.mp3",
        },
        {
          id: 2,
          title: "Active",
          date: "2026-10-21",
          status: "live",
          audioPath: "/old/2/audio.mp3",
        },
      ]
    if (command === "get_recordings_location") return location
    if (command === "move_recordings_root") return { moved: 1, failed: [] }
    if (command === "set_recordings_root")
      return { path: "/new", defaultPath: "/old", isDefault: false }
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})
async function mount() {
  await act(async () => root.render(<StoragePanel />))
}

it("keeps active recordings out of the deletion list while showing the storage location", async () => {
  await mount()
  expect(container.textContent).toContain("/old")
  expect(
    container.querySelector('[aria-label="Delete recording for Finished"]')
  ).not.toBeNull()
  expect(
    container.querySelector('[aria-label="Delete recording for Active"]')
  ).toBeNull()
})
it("moves recordings before changing the root when the operator confirms", async () => {
  await mount()
  const button = [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Change")
  )!
  await act(async () => button.click())
  const calls = native.invoke.mock.calls.map((call) => call[0])
  expect(calls.indexOf("move_recordings_root")).toBeGreaterThan(-1)
  expect(calls.indexOf("set_recordings_root")).toBeGreaterThan(
    calls.indexOf("move_recordings_root")
  )
  expect(native.invoke).toHaveBeenCalledWith("set_recordings_root", {
    path: "/new",
  })
})
it("keeps existing files in place when the operator declines a move", async () => {
  native.ask.mockResolvedValue(false)
  await mount()
  const button = [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Change")
  )!
  await act(async () => button.click())
  expect(
    native.invoke.mock.calls.some((call) => call[0] === "move_recordings_root")
  ).toBe(false)
  expect(native.invoke).toHaveBeenCalledWith("set_recordings_root", {
    path: "/new",
  })
})
it("reports a load failure instead of leaving an unhandled request", async () => {
  native.invoke.mockRejectedValue(new Error("Unavailable"))
  await mount()
  expect(native.error).toHaveBeenCalledWith(
    expect.stringContaining("Could not load storage")
  )
})
