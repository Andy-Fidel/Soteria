import { beforeEach, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { useSessionStore } from "@/stores/session-store"
import { useTranscriptStore } from "@/stores/transcript-store"
import { restoreLiveSession } from "./restore-live-session"
import type { SermonSession } from "@/types/session"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))

const session: SermonSession = {
  id: 5,
  title: "Resumed service",
  speaker: null,
  date: "2026-10-17",
  seriesName: null,
  tags: [],
  startedAt: "2026-10-17T08:00:00Z",
  endedAt: null,
  status: "live",
  plannedScriptures: [],
  summary: null,
  audioPath: null,
  createdAt: "2026-10-17T08:00:00Z",
  updatedAt: "2026-10-17T08:00:00Z",
}

beforeEach(() => {
  vi.mocked(invoke).mockReset()
  useSessionStore.setState({ activeSession: null })
  useTranscriptStore.setState({ segments: [], currentPartial: "" })
})

it("restores the saved transcript before activating a resumed session", async () => {
  vi.mocked(invoke).mockResolvedValue([
    {
      id: 7,
      sessionId: 5,
      text: "Saved teaching",
      isFinal: true,
      confidence: 0.9,
      timestampMs: 5000,
      speakerLabel: null,
    },
  ])
  await expect(restoreLiveSession(session)).resolves.toBe(true)
  expect(useSessionStore.getState().activeSession?.id).toBe(5)
  expect(useTranscriptStore.getState().segments).toEqual([
    {
      id: "saved-7",
      text: "Saved teaching",
      is_final: true,
      confidence: 0.9,
      timestamp: 5000,
      words: [],
    },
  ])
})

it("keeps live in-memory transcript when reopening the same session", async () => {
  useSessionStore.setState({ activeSession: session })
  useTranscriptStore.setState({
    segments: [
      {
        id: "current",
        text: "Live words",
        is_final: true,
        confidence: 1,
        timestamp: 5001,
        words: [],
      },
    ],
  })
  await expect(restoreLiveSession(session)).resolves.toBe(true)
  expect(useTranscriptStore.getState().segments[0].text).toBe("Live words")
  expect(invoke).not.toHaveBeenCalled()
})

it("does not replace another session selected while the saved transcript is loading", async () => {
  let finish!: (rows: []) => void
  vi.mocked(invoke).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const restoring = restoreLiveSession(session)
  useSessionStore.getState().setActiveSession({ ...session, id: 6 })
  finish([])
  await expect(restoring).resolves.toBe(false)
  expect(useSessionStore.getState().activeSession?.id).toBe(6)
})
