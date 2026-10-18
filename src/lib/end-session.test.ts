import { beforeEach, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { useSession } from "@/hooks/use-session"
import { useSessionStore } from "@/stores/session-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import type { SermonSession } from "@/types"
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))
const live: SermonSession = {
  id: 1,
  title: "Live",
  titleSource: "manual",
  status: "live",
  date: "2026-10-18",
  speaker: null,
  seriesName: null,
  startedAt: null,
  endedAt: null,
  summary: null,
  audioPath: null,
  tags: [],
  plannedScriptures: [],
  createdAt: "",
  updatedAt: "",
}
beforeEach(() => {
  vi.mocked(invoke).mockReset()
  useSessionStore.setState({ activeSession: live, sessions: [live] })
  useTranscriptStore.setState({
    isTranscribing: true,
    currentPartial: "last words",
    connectionStatus: "connected",
  })
})
it("stops and merges the requested session before marking it completed", async () => {
  const calls: string[] = []
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    calls.push(command)
    if (command === "stop_transcription") expect(args).toEqual({ sessionId: 1 })
    return command === "end_session"
      ? { ...live, status: "completed" }
      : undefined
  })
  await useSession().endSession(1)
  expect(calls).toEqual([
    "stop_transcription",
    "finalize_session_audio",
    "end_session",
  ])
  expect(useSessionStore.getState().activeSession?.status).toBe("completed")
  expect(useTranscriptStore.getState().isTranscribing).toBe(false)
  expect(useTranscriptStore.getState().currentPartial).toBe("")
})
it("does not change another active session's recording state", async () => {
  vi.mocked(invoke).mockImplementation(async (command) =>
    command === "end_session"
      ? { ...live, id: 2, status: "completed" }
      : undefined
  )
  await useSession().endSession(2)
  expect(invoke).toHaveBeenCalledWith("stop_transcription", { sessionId: 2 })
  expect(useSessionStore.getState().activeSession).toBe(live)
  expect(useTranscriptStore.getState().isTranscribing).toBe(true)
})
it("keeps the session live and surfaces a failed audio merge", async () => {
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "finalize_session_audio") throw new Error("Disk full")
    return { ...live, status: "completed" }
  })
  await expect(useSession().endSession(1)).rejects.toThrow("Disk full")
  expect(invoke).not.toHaveBeenCalledWith("end_session", expect.anything())
  expect(useSessionStore.getState().activeSession?.status).toBe("live")
})
it("waits for the last transcript save before completing the session", async () => {
  const { handleTranscriptFinal } = await import("./transcription-events")
  let saveWords!: () => void
  vi.mocked(invoke).mockImplementation(async (command) => {
    if (command === "add_session_transcript")
      await new Promise<void>((resolve) => {
        saveWords = resolve
      })
    return command === "end_session"
      ? { ...live, status: "completed" }
      : undefined
  })
  const saving = handleTranscriptFinal({
    text: "Last captured words",
    is_final: true,
    confidence: 1,
  })
  const ending = useSession().endSession(1)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const completedEarly = vi
    .mocked(invoke)
    .mock.calls.some(([command]) => command === "end_session")
  saveWords()
  await Promise.all([saving, ending])
  expect(completedEarly).toBe(false)
})
