import { beforeEach, expect, it, vi } from "vitest"
const invoke = vi.hoisted(() => vi.fn())
const checkLocalResources = vi.hoisted(() => vi.fn())
vi.mock("@tauri-apps/api/core", () => ({ invoke }))
vi.mock("./offline-readiness", () => ({ checkLocalResources }))
import { startServiceFlow } from "./start-service"
import { useSessionStore, useSettingsStore, useTranscriptStore } from "@/stores"

beforeEach(() => {
  vi.clearAllMocks()
  useSessionStore.setState({ activeSession: null })
  useSettingsStore.setState({ sttProvider: "whisper" })
  vi.stubGlobal("alert", vi.fn())
})
it("does not create or promote a session when offline resources are missing", async () => {
  checkLocalResources.mockResolvedValue([
    { status: "fail", detail: "Install Bible text" },
  ])
  await startServiceFlow()
  expect(invoke).not.toHaveBeenCalled()
  expect(useSessionStore.getState().activeSession).toBeNull()
  expect(alert).toHaveBeenCalledWith("Error: Install Bible text")
})
it("starts local capture without a speech API key when resources are ready", async () => {
  checkLocalResources.mockResolvedValue([{ status: "pass" }])
  const session = { id: 42, status: "planned", title: "Local service" }
  invoke.mockImplementation(async (command) => {
    if (command === "create_session") return session
    if (command === "start_session") return { ...session, status: "live" }
  })
  await startServiceFlow()
  expect(invoke).toHaveBeenCalledWith(
    "start_transcription",
    expect.objectContaining({ provider: "whisper", apiKey: "", sessionId: 42 })
  )
  expect(useTranscriptStore.getState().connectionStatus).toBe("connecting")
})

it("shares concurrent starts while resource checks are in progress", async () => {
  let complete!: (checks: { status: string }[]) => void
  checkLocalResources.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve }))
  invoke.mockImplementation(async (command) => {
    if (command === "create_session") return { id: 43, status: "planned" }
    if (command === "start_session") return { id: 43, status: "live" }
  })
  const first = startServiceFlow()
  const second = startServiceFlow()
  complete([{ status: "pass" }])
  await Promise.all([first, second])
  expect(checkLocalResources).toHaveBeenCalledTimes(1)
  expect(invoke.mock.calls.filter(([command]) => command === "create_session")).toHaveLength(1)
  expect(invoke.mock.calls.filter(([command]) => command === "start_transcription")).toHaveLength(1)
})
