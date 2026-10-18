import { beforeEach, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import {
  hasTitleAnnouncement,
  createLiveTitleDetector,
} from "./live-sermon-title"
import { useSessionStore } from "@/stores/session-store"
import { useSettingsStore } from "@/stores/settings-store"
import type { SermonSession } from "@/types/session"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))
const session: SermonSession = {
  id: 27,
  title: "Sunday service",
  titleSource: "default",
  status: "live",
  speaker: null,
  date: "2026-10-18",
  seriesName: null,
  tags: [],
  startedAt: null,
  endedAt: null,
  plannedScriptures: [],
  summary: null,
  audioPath: null,
  createdAt: "",
  updatedAt: "",
}

beforeEach(() => {
  vi.resetAllMocks()
  useSessionStore.setState({
    activeSession: session,
    sessions: [session],
    sessionsView: null,
  })
  useSettingsStore.setState({ deepseekApiKey: "test-key" })
})

it.each([
  "My message today is titled Faith in the Waiting.",
  "Today I’m speaking on Faith in the Waiting.",
  "This morning I want to preach on Grace for Today.",
  "I have entitled my message Walking by Faith.",
  "I've titled today's message Faith in the Waiting.",
  "The title of my sermon is Grace for Today.",
  "Today I want to speak to you on Walking by Faith.",
  "Our topic this morning is The Power of Prayer.",
])("spots a likely announcement: %s", (text) =>
  expect(hasTitleAnnouncement(text)).toBe(true)
)

it.each([
  "God gives us faith in the waiting.",
  "Let us sing Amazing Grace.",
  "Our first point is prayer.",
  "Yesterday the pastor preached about faith.",
])("skips ordinary speech: %s", (text) =>
  expect(hasTitleAnnouncement(text)).toBe(false)
)

it("joins final segments, saves the title and updates the live and saved session views", async () => {
  const detector = createLiveTitleDetector()
  vi.mocked(invoke).mockResolvedValue({
    ...session,
    title: "Faith in the Waiting",
    titleSource: "announced",
  })
  await detector("My message today is")
  await detector("titled Faith in the Waiting.")
  expect(useSessionStore.getState().activeSession?.title).toBe(
    "Faith in the Waiting"
  )
  expect(useSessionStore.getState().sessions[0].title).toBe(
    "Faith in the Waiting"
  )
})

it("never requests a title for manual names or missing keys", async () => {
  const detector = createLiveTitleDetector()
  useSessionStore.setState({
    activeSession: { ...session, titleSource: "manual" },
  })
  await detector("My message today is titled Faith.")
  useSessionStore.setState({ activeSession: session })
  useSettingsStore.setState({ deepseekApiKey: null })
  await detector("My message today is titled Grace.")
  expect(invoke).not.toHaveBeenCalled()
})

it("does not replace a manual edit, ended session or different session with a late result", async () => {
  for (const changed of [
    { ...session, title: "My name", titleSource: "manual" as const },
    { ...session, status: "completed" as const },
    { ...session, id: 28 },
  ]) {
    useSessionStore.setState({ activeSession: session })
    let finish!: (s: SermonSession) => void
    vi.mocked(invoke).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve as typeof finish
        })
    )
    const detector = createLiveTitleDetector()
    const pending = detector("My message today is titled Grace.")
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"))
    useSessionStore.setState({ activeSession: changed })
    finish({ ...session, title: "Grace", titleSource: "announced" })
    await pending
    expect(useSessionStore.getState().activeSession).toEqual(changed)
  }
})

it("allows only one request at a time and bounds failed or rejected checks", async () => {
  const detector = createLiveTitleDetector()
  vi.mocked(invoke).mockResolvedValue(null)
  for (let i = 0; i < 100; i++)
    await detector(`My message today is titled Topic ${i}.`)
  expect(vi.mocked(invoke).mock.calls.length).toBeLessThanOrEqual(3)
})

it("waits for the rest of an announcement and does not use a stale partial title", async () => {
  const detector = createLiveTitleDetector()
  vi.mocked(invoke).mockResolvedValue(null)
  const first = detector("My message today is titled Faith")
  expect(invoke).not.toHaveBeenCalled()
  const second = detector("in the Waiting.")
  await Promise.all([first, second])
  expect(invoke).toHaveBeenCalledTimes(1)
})

it("continues transcript capture while the title request is pending", async () => {
  const { handleTranscriptFinal } = await import("./transcription-events")
  const { useTranscriptStore } = await import("@/stores/transcript-store")
  useTranscriptStore.getState().clearTranscript()
  vi.mocked(invoke).mockImplementation((command) =>
    command === "detect_session_title"
      ? new Promise(() => {})
      : Promise.resolve(undefined)
  )
  const started = performance.now()
  await handleTranscriptFinal({
    text: "My message today is titled Grace.",
    is_final: true,
    confidence: 1,
  })
  await handleTranscriptFinal({
    text: "Let us turn to John chapter three.",
    is_final: true,
    confidence: 1,
  })
  expect(useTranscriptStore.getState().segments.map((s) => s.text)).toEqual([
    "My message today is titled Grace.",
    "Let us turn to John chapter three.",
  ])
  expect(performance.now() - started).toBeLessThan(100)
  // End the session before the scheduled check to avoid a leaked request.
  useSessionStore.setState({ activeSession: null })
  await new Promise((resolve) => setTimeout(resolve, 650))
})

it("queues adjoining words during a pending check without parallel requests", async () => {
  const detector = createLiveTitleDetector()
  let finish!: (s: null) => void
  vi.mocked(invoke).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve as typeof finish
      })
  )
  vi.mocked(invoke).mockResolvedValueOnce({
    ...session,
    title: "Faith in the Waiting",
    titleSource: "announced",
  })
  const first = detector("My message today is titled Faith")
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"))
  const next = detector("in the Waiting.")
  expect(invoke).toHaveBeenCalledTimes(1)
  finish(null)
  await Promise.all([first, next])
  expect(invoke).toHaveBeenCalledTimes(2)
  expect(useSessionStore.getState().activeSession?.title).toBe(
    "Faith in the Waiting"
  )
})

it("measures the local trigger on ordinary speech", () => {
  const phrases = [
    "Open your Bibles to John chapter three.",
    "Trust the Lord in every season.",
    "Let us sing together.",
  ]
  const runs = []
  for (let batch = 0; batch < 7; batch++) {
    const started = performance.now()
    for (let i = 0; i < 10000; i++)
      hasTitleAnnouncement(phrases[i % phrases.length])
    runs.push((performance.now() - started) / 10000)
  }
  runs.sort((a, b) => a - b)
  console.info(
    `Live title local trigger median_ms=${runs[3].toFixed(6)} max_batch_average_ms=${runs[6].toFixed(6)}`
  )
  expect(phrases.every((text) => !hasTitleAnnouncement(text))).toBe(true)
})

it("keeps the current name after a network failure and can check a later announcement", async () => {
  const detector = createLiveTitleDetector()
  vi.mocked(invoke).mockRejectedValueOnce(new Error("offline"))
  await detector("My message today is titled Grace.")
  expect(useSessionStore.getState().activeSession?.title).toBe("Sunday service")
  vi.mocked(invoke).mockResolvedValueOnce({ ...session, title: "Grace", titleSource: "announced" })
  await detector("The title of my sermon is Grace.")
  expect(useSessionStore.getState().activeSession?.title).toBe("Grace")
})
