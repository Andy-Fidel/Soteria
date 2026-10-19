import { describe, expect, it } from "vitest"
import { expandSessionSlides, type SavedSessionSlide } from "./session-slides"

const row = (payload: unknown): SavedSessionSlide => ({
  id: 4,
  sessionId: 2,
  sourceItemId: 8,
  itemData: JSON.stringify(payload),
  savedAt: "2026-10-19 12:00:00",
})
describe("saved session slides", () => {
  it("uses saved text instead of the current session title", () => {
    const saved = row({
      type: "blank",
      imageUrl: "/bg.png",
      textOverlay: {
        layout: "title",
        title: "Original title",
        body: "Original speaker",
      },
    })
    const slides = expandSessionSlides([saved])
    expect(slides).toHaveLength(1)
    expect(slides[0].image.textOverlay).toEqual({
      layout: "title",
      title: "Original title",
      body: "Original speaker",
    })
    expect(slides[0].title).toBe("Original title")
  })
  it("includes each prayer point as its own downloadable slide", () => {
    const slides = expandSessionSlides([
      row({
        type: "blank",
        imageUrl: "/bg.png",
        prayer: {
          background: "hands",
          points: ["Pray for peace", "Pray for families"],
        },
      }),
    ])
    expect(slides.map((slide) => slide.image.textOverlay?.body)).toEqual([
      "Pray for peace",
      "Pray for families",
    ])
    expect(new Set(slides.map((slide) => slide.key)).size).toBe(2)
  })
  it("keeps uploaded image data and skips damaged records", () => {
    const uploaded = row({
      type: "blank",
      imageUrl: "data:image/png;base64,abc",
      imageLabel: "Welcome",
    })
    const slides = expandSessionSlides([
      uploaded,
      { ...uploaded, id: 5, itemData: "broken" },
      row({}),
    ])
    expect(slides).toHaveLength(1)
    expect(slides[0].image.url).toBe("data:image/png;base64,abc")
  })
})
