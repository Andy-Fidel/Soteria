import { describe, expect, it } from "vitest"
import { BUILTIN_THEMES } from "./builtin-themes"
import { computeVerseLayoutMetrics, renderVerse } from "./verse-renderer"
import type { BroadcastTheme, VerseRenderData } from "@/types"

function measureContext(): CanvasRenderingContext2D {
  return {
    save: () => {},
    restore: () => {},
    measureText: (text: string) => ({ width: text.length * 24 }),
  } as unknown as CanvasRenderingContext2D
}

const verse: VerseRenderData = {
  reference: "John 3:16 (KJV)",
  segments: [{ verseNumber: 16, text: "For God so loved the world." }],
}

describe("verse renderer layout", () => {
  it("maps rendered words back to source offsets and highlight geometry", () => {
    const highlighted: VerseRenderData = {
      ...verse,
      highlights: [
        { segmentIndex: 0, start: 4, end: 7, color: "#FACC15", sourceText: "God" },
      ],
    }

    const metrics = computeVerseLayoutMetrics(
      measureContext(),
      BUILTIN_THEMES[0],
      highlighted,
      { collectWordHits: true },
    )

    expect(metrics.wordHits.map(({ start, end }) => ({ start, end }))).toEqual([
      { start: 0, end: 3 },
      { start: 4, end: 7 },
      { start: 8, end: 10 },
      { start: 11, end: 16 },
      { start: 17, end: 20 },
      { start: 21, end: 27 },
    ])
    expect(metrics.highlightRects).toHaveLength(1)
    expect(metrics.highlightRects[0].color).toBe("#FACC15")
  })

  it("computes projector highlight geometry for standalone-reference themes", () => {
    const standaloneTheme: BroadcastTheme = {
      ...BUILTIN_THEMES[0],
      reference: {
        ...BUILTIN_THEMES[0].reference,
        standalone: { anchor: "bottom-right", margin: 24 },
      },
    }
    const highlighted: VerseRenderData = {
      ...verse,
      highlights: [
        { segmentIndex: 0, start: 4, end: 7, color: "#FACC15", sourceText: "God" },
      ],
    }

    const metrics = computeVerseLayoutMetrics(measureContext(), standaloneTheme, highlighted)

    expect(metrics.highlightRects).toHaveLength(1)
  })

  it.each(["center-left", "center-right"] as const)(
    "computes finite layout metrics for %s anchor",
    (anchor) => {
      const theme: BroadcastTheme = {
        ...BUILTIN_THEMES[0],
        layout: {
          ...BUILTIN_THEMES[0].layout,
          anchor,
        },
      }

      const metrics = computeVerseLayoutMetrics(measureContext(), theme, verse)

      expect(Number.isFinite(metrics.textAreaRect.x)).toBe(true)
      expect(Number.isFinite(metrics.textAreaRect.y)).toBe(true)
      expect(Number.isFinite(metrics.textRect.x)).toBe(true)
      expect(Number.isFinite(metrics.textRect.y)).toBe(true)
    },
  )
})


it("fills spaces between selected words with one continuous band on each line", () => {
  const highlighted: VerseRenderData = {
    ...verse,
    highlights: [{ segmentIndex: 0, start: 0, end: verse.segments[0].text.length,
      color: "#F472B6", sourceText: verse.segments[0].text }],
  }
  const theme: BroadcastTheme = {
    ...BUILTIN_THEMES[0],
    resolution: { width: 500, height: 1080 },
    layout: { ...BUILTIN_THEMES[0].layout, padding: { top: 0, bottom: 0, left: 0, right: 0 } },
    verseText: { ...BUILTIN_THEMES[0].verseText, autoFit: false },
  }
  const metrics = computeVerseLayoutMetrics(measureContext(), theme, highlighted, { collectWordHits: true })
  const lines = new Map<number, typeof metrics.wordHits>()
  for (const hit of metrics.wordHits) lines.set(hit.y, [...(lines.get(hit.y) ?? []), hit])
  expect(lines.size).toBeGreaterThan(1)
  expect(metrics.highlightRects).toHaveLength(lines.size)
  for (const [y, words] of lines) {
    const band = metrics.highlightRects.find((rect) => rect.y >= y && rect.y < y + words[0].height)!
    expect(band.x).toBeLessThanOrEqual(words[0].x)
    expect(band.x + band.width).toBeGreaterThanOrEqual(words.at(-1)!.x + words.at(-1)!.width)
  }
})

it("uses the drawn letter spacing for word selection boundaries", () => {
  let letterSpacing = "0px"
  const saved: string[] = []
  const context = {
    save: () => { saved.push(letterSpacing) },
    restore: () => { letterSpacing = saved.pop() ?? "0px" },
    get letterSpacing() { return letterSpacing },
    set letterSpacing(value: string) { letterSpacing = value },
    measureText: (text: string) => ({ width: text.length * (24 + parseFloat(letterSpacing)) }),
  } as unknown as CanvasRenderingContext2D
  const theme: BroadcastTheme = {
    ...BUILTIN_THEMES[0],
    verseNumbers: { ...BUILTIN_THEMES[0].verseNumbers, visible: false },
    verseText: { ...BUILTIN_THEMES[0].verseText, letterSpacing: 8, autoFit: false, horizontalAlign: "left" },
  }
  const metrics = computeVerseLayoutMetrics(context, theme, verse, { collectWordHits: true })
  expect(metrics.wordHits[1].x - metrics.wordHits[0].x).toBe(4 * (24 + 8))
  expect(metrics.wordHits[1].width).toBe(3 * (24 + 8))
})


it("draws centered-line text using the same alignment as its selection boxes", () => {
  const draws: Array<{ text: string; align: CanvasTextAlign }> = []
  const context = new Proxy(measureContext(), {
    get(target, key) {
      return key in target ? Reflect.get(target, key) : () => {}
    },
  })
  context.fillText = (text) => { draws.push({ text, align: context.textAlign }) }
  const theme: BroadcastTheme = {
    ...BUILTIN_THEMES[0],
    verseText: { ...BUILTIN_THEMES[0].verseText, horizontalAlign: "left", lineBreakMode: "centered-lines" },
    logo: undefined,
  }
  expect(renderVerse(context, theme, verse, { collectWordHits: true })).not.toBeNull()
  expect(draws.find((draw) => draw.text.startsWith("For God"))?.align).toBe("center")
})
