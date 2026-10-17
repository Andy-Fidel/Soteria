import { beforeEach, expect, it } from "vitest"
import { useSessionStore } from "./session-store"
import { useTranscriptStore } from "./transcript-store"
import { useDetectionStore } from "./detection-store"
import type { SermonSession } from "@/types/session"

const session: SermonSession = {
  id: 1,
  title: "First service",
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
  createdAt: "2026-10-17T08:00:00Z",
  updatedAt: "2026-10-17T08:00:00Z",
}

beforeEach(() => {
  useSessionStore.setState({ activeSession: session })
  useTranscriptStore.setState({
    segments: [
      {
        id: "old",
        text: "Previous sermon",
        timestamp: 1,
        is_final: true,
        confidence: 1,
        words: [],
      },
    ],
    currentPartial: "Old partial",
  })
  useDetectionStore.setState({
    detections: [
      {
        verse_ref: "John 3:16",
        verse_text: "Previous scripture",
        book_name: "John",
        book_number: 43,
        chapter: 3,
        verse: 16,
        confidence: 1,
        source: "direct",
        auto_queued: false,
        transcript_snippet: "Previous sermon",
      },
    ],
  })
})

it("clears transcript and detections when a different session is activated", () => {
  useSessionStore.getState().setActiveSession({ ...session, id: 2 })
  expect(useTranscriptStore.getState()).toMatchObject({
    segments: [],
    currentPartial: "",
  })
  expect(useDetectionStore.getState().detections).toEqual([])
})

it("keeps the current transcript when the same session status changes", () => {
  useSessionStore
    .getState()
    .setActiveSession({ ...session, status: "completed" })
  expect(useTranscriptStore.getState().segments[0].text).toBe("Previous sermon")
  expect(useDetectionStore.getState().detections).toHaveLength(1)
})

it("clears session content when leaving the session", () => {
  useSessionStore.getState().setActiveSession(null)
  expect(useTranscriptStore.getState()).toMatchObject({
    segments: [],
    currentPartial: "",
  })
  expect(useDetectionStore.getState().detections).toEqual([])
})
