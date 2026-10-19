import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { invoke } from "@tauri-apps/api/core"
import {
  handleSttConnection,
  handleTranscriptFinal,
  handleTranscriptPartial,
} from "@/lib/transcription-events"
import { useAudioStore } from "./audio-store"
import { useTranscriptStore } from "./transcript-store"
import { useSessionStore } from "./session-store"
import type { SermonSession } from "@/types/session"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
vi.mock("@/lib/live-sermon-title", () => ({
  detectLiveSermonTitle: vi.fn().mockResolvedValue(undefined),
}))

const session: SermonSession = {
  id: 17,
  title: "Service",
  speaker: null,
  date: "2026-10-17",
  seriesName: null,
  tags: [],
  startedAt: null,
  endedAt: null,
  status: "live",
  plannedScriptures: [],
  summary: null,
  audioPath: null,
  createdAt: "2026-10-17",
  updatedAt: "2026-10-17",
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(invoke).mockResolvedValue(undefined)
  useTranscriptStore.setState({
    segments: [],
    currentPartial: "",
    isTranscribing: false,
    transcribingStartedAt: null,
    connectionStatus: "disconnected",
  })
  useSessionStore.setState({ activeSession: null })
  useAudioStore.setState({ level: { rms: 0, peak: 0 }, isCapturing: false })
})

describe("production transcription event handlers", () => {
  it("keeps transcription active through transient reconnects", () => {
    handleSttConnection("stt_connected")
    const startedAt = useTranscriptStore.getState().transcribingStartedAt
    handleTranscriptPartial({
      text: "still speaking",
      is_final: false,
      confidence: 1,
    })
    for (let i = 0; i < 5; i++) {
      handleSttConnection("stt_reconnecting")
      expect(useTranscriptStore.getState()).toMatchObject({
        isTranscribing: true,
        connectionStatus: "reconnecting",
        currentPartial: "still speaking",
      })
      handleSttConnection("stt_connected")
    }
    expect(useTranscriptStore.getState().transcribingStartedAt).toBe(startedAt)
  })

  it.each(["stt_disconnected", "stt_error"] as const)(
    "%s stops transcription and clears partial text",
    (event) => {
      handleSttConnection("stt_connected")
      handleTranscriptPartial({
        text: "partial",
        is_final: false,
        confidence: 1,
      })
      handleSttConnection(event)
      expect(useTranscriptStore.getState()).toMatchObject({
        isTranscribing: false,
        currentPartial: "",
        transcribingStartedAt: null,
        connectionStatus: event === "stt_error" ? "error" : "disconnected",
      })
    }
  )

  it("persists a final transcript to the live session with the same timestamp and zero confidence", async () => {
    useSessionStore.setState({ activeSession: session })
    await handleTranscriptFinal({
      text: "final words",
      is_final: true,
      confidence: 0,
    })
    const segment = useTranscriptStore.getState().segments[0]
    expect(segment.text).toBe("final words")
    expect(useTranscriptStore.getState().currentPartial).toBe("")
    expect(invoke).toHaveBeenCalledExactlyOnceWith("add_session_transcript", {
      request: {
        sessionId: 17,
        text: "final words",
        isFinal: true,
        confidence: 0,
        timestampMs: segment.timestamp,
        speakerLabel: null,
      },
    })
  })

  it.each([null, { ...session, status: "completed" } satisfies SermonSession])(
    "does not persist without a live session",
    async (session) => {
      useSessionStore.setState({ activeSession: session })
      await handleTranscriptFinal({
        text: "words",
        is_final: true,
        confidence: 1,
      })
      expect(useTranscriptStore.getState().segments).toHaveLength(1)
      expect(invoke).not.toHaveBeenCalled()
    }
  )

  it("surfaces persistence failure and retains the visible transcript", async () => {
    useSessionStore.setState({ activeSession: session })
    vi.mocked(invoke).mockRejectedValueOnce(new Error("database unavailable"))
    await expect(
      handleTranscriptFinal({ text: "keep me", is_final: true, confidence: 1 })
    ).rejects.toThrow("database unavailable")
    expect(useTranscriptStore.getState().segments[0].text).toBe("keep me")
  })
})

describe("microphone recovery", () => {
  it.each(["stt_error", "stt_disconnected"] as const)(
    "%s clears a frozen microphone meter",
    (event) => {
      useAudioStore.setState({
        level: { rms: 0.4, peak: 0.7 },
        isCapturing: true,
      })
      handleSttConnection(event)
      expect(useAudioStore.getState()).toMatchObject({
        level: { rms: 0, peak: 0 },
        isCapturing: false,
      })
    }
  )

  it("retains earlier speech and saves resumed speech to the same session after a microphone restart", async () => {
    useSessionStore.setState({ activeSession: session })
    handleSttConnection("stt_connected")
    await handleTranscriptFinal({
      text: "John chapter three verse sixteen",
      is_final: true,
      confidence: 0.99,
    })
    handleTranscriptPartial({
      text: "unfinished words",
      is_final: false,
      confidence: 0.9,
    })
    handleSttConnection("stt_error")
    expect(useTranscriptStore.getState().currentPartial).toBe("")
    handleSttConnection("stt_disconnected")
    handleSttConnection("stt_connected")
    await handleTranscriptFinal({
      text: "Romans chapter eight verse twenty eight",
      is_final: true,
      confidence: 0.99,
    })
    expect(
      useTranscriptStore.getState().segments.map((segment) => segment.text)
    ).toEqual([
      "John chapter three verse sixteen",
      "Romans chapter eight verse twenty eight",
    ])
    expect(useTranscriptStore.getState()).toMatchObject({
      isTranscribing: true,
      connectionStatus: "connected",
      currentPartial: "",
    })
    const writes = vi
      .mocked(invoke)
      .mock.calls.filter(([command]) => command === "add_session_transcript")
    expect(writes).toHaveLength(2)
    for (const [, args] of writes)
      expect(args).toMatchObject({ request: { sessionId: 17 } })
    expect(vi.mocked(invoke).mock.calls.map(([command]) => command)).toEqual([
      "add_session_transcript",
      "add_session_transcript",
    ])
  })
})

it("shows the microphone recovery instruction from the native error", () => {
  const message =
    "Microphone input stopped. Reconnect the microphone, then click Start to resume."
  handleSttConnection("stt_error", message)
  expect(toast.error).toHaveBeenCalledWith(message)
})
