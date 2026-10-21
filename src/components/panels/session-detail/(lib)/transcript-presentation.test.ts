import { expect, it } from "vitest"
import {
  transcriptArtwork,
  sessionSlidesWithTitle,
  sessionStartedAtMs,
  activeTranscriptId,
} from "./transcript-presentation"
import { formatAudioTime } from "@/lib/session-audio-timeline"
import type { GallerySlide } from "./session-slides"

it("uses the latest saved title artwork, skipping announcements", () => {
  const slides: GallerySlide[] = [
    {
      key: "3",
      title: "Welcome",
      savedAt: "",
      image: {
        url: "/welcome.png",
        label: "Welcome",
        textOverlay: { layout: "announcement", title: "Welcome", body: "" },
      },
    },
    {
      key: "2",
      title: "Saved title",
      savedAt: "",
      image: {
        url: "/saved.png",
        label: "Title",
        textOverlay: {
          layout: "title",
          title: "Saved title",
          body: "Guest speaker",
        },
      },
    },
  ]
  expect(transcriptArtwork(slides, "New session name", null)).toEqual(
    slides[1].image
  )
})

it("uses the session name for older sessions without assigning an unknown speaker's photo", () => {
  expect(transcriptArtwork([], "Living by faith", null)).toEqual({
    url: "/service-slides/starburst-black.png",
    label: "Living by faith",
    textOverlay: { layout: "title", title: "Living by faith", body: "" },
  })
  expect(transcriptArtwork([], "Faith", "Pastor Jane").textOverlay?.body).toBe(
    "Pastor Jane"
  )
})

it("parses database UTC dates and explicit offsets without changing the instant", () => {
  expect(sessionStartedAtMs("2026-10-19 12:00:00")).toBe(1792411200000)
  expect(sessionStartedAtMs("2026-10-19T14:00:00+02:00")).toBe(1792411200000)
  expect(sessionStartedAtMs(null)).toBeNaN()
})

it("finds the current segment from recording offsets and handles backwards seeking", () => {
  const segments = [
    { id: 1, seconds: 0 },
    { id: 2, seconds: 10.08 },
    { id: 3, seconds: 17.16 },
  ]
  expect(activeTranscriptId(segments, null)).toBeNull()
  expect(activeTranscriptId(segments, 12)).toBe(2)
  expect(activeTranscriptId(segments, 2)).toBe(1)
  expect(activeTranscriptId([], 2)).toBeNull()
})

it("formats recording positions without wrapping at one hour or showing invalid numbers", () => {
  expect(formatAudioTime(68)).toBe("01:08")
  expect(formatAudioTime(3661)).toBe("1:01:01")
  expect(formatAudioTime(Number.NaN)).toBe("00:00")
})

it("automatically provides a downloadable title slide and follows the current session name", () => {
  const first = sessionSlidesWithTitle([], 12, "Faith", "Pastor Jane")
  expect(first).toHaveLength(1)
  expect(first[0].image.textOverlay).toEqual({
    layout: "title",
    title: "Faith",
    body: "Pastor Jane",
  })
  expect(sessionSlidesWithTitle([], 12, "New title", null)[0].title).toBe(
    "New title"
  )
  expect(sessionSlidesWithTitle([], 13, "Other session", null)[0].key).not.toBe(
    first[0].key
  )
})
it("keeps existing title slides and other saved artwork without adding a duplicate", () => {
  const title = sessionSlidesWithTitle([], 12, "Custom title", null)[0]
  const slides = [title]
  expect(sessionSlidesWithTitle(slides, 12, "Renamed session", null)).toBe(
    slides
  )
  const announcement: GallerySlide = {
    key: "welcome",
    title: "Welcome",
    image: { url: "/welcome.png", label: "Welcome" },
    savedAt: "",
  }
  const result = sessionSlidesWithTitle([announcement], 12, "Faith", null)
  expect(result).toHaveLength(2)
  expect(result[1]).toBe(announcement)
  expect(result[0].image).toEqual(transcriptArtwork([], "Faith", null))
})
