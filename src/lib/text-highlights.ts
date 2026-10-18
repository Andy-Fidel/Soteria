import type { TextHighlight, WordHitBox } from "@/types"

export const HIGHLIGHT_COLORS = ["#FACC15", "#FB923C", "#F472B6", "#A78BFA", "#60A5FA", "#4ADE80"] as const
export const DEFAULT_HIGHLIGHT_COLOR = HIGHLIGHT_COLORS[0]

export function normalizeHighlightColor(color: string): string {
  const normalized = color.toUpperCase()
  return HIGHLIGHT_COLORS.includes(normalized as (typeof HIGHLIGHT_COLORS)[number])
    ? normalized
    : DEFAULT_HIGHLIGHT_COLOR
}

export function validHighlights(text: string, highlights: readonly TextHighlight[]): TextHighlight[] {
  return highlights.filter((highlight) =>
    highlight.segmentIndex === 0 &&
    Number.isInteger(highlight.start) &&
    Number.isInteger(highlight.end) &&
    highlight.start >= 0 &&
    highlight.end > highlight.start &&
    highlight.end <= text.length &&
    text.slice(highlight.start, highlight.end) === highlight.sourceText &&
    normalizeHighlightColor(highlight.color) === highlight.color.toUpperCase(),
  ).map((highlight) => ({ ...highlight, color: highlight.color.toUpperCase() }))
}

function subtractRange(
  text: string,
  highlight: TextHighlight,
  range: Pick<TextHighlight, "segmentIndex" | "start" | "end">,
): TextHighlight[] {
  if (
    highlight.segmentIndex !== range.segmentIndex ||
    highlight.end <= range.start ||
    highlight.start >= range.end
  ) return [highlight]

  const pieces: TextHighlight[] = []
  if (highlight.start < range.start) {
    pieces.push({
      ...highlight,
      end: range.start,
      sourceText: text.slice(highlight.start, range.start),
    })
  }
  if (highlight.end > range.end) {
    pieces.push({
      ...highlight,
      start: range.end,
      sourceText: text.slice(range.end, highlight.end),
    })
  }
  return pieces
}

function sortHighlights(highlights: TextHighlight[]): TextHighlight[] {
  return highlights.sort((a, b) =>
    a.segmentIndex - b.segmentIndex || a.start - b.start || a.end - b.end,
  )
}

export function clearHighlightRange(
  text: string,
  highlights: readonly TextHighlight[],
  range: Pick<TextHighlight, "segmentIndex" | "start" | "end">,
): TextHighlight[] {
  return sortHighlights(validHighlights(text, highlights).flatMap((highlight) =>
    subtractRange(text, highlight, range),
  ))
}

export function applyHighlight(
  text: string,
  highlights: readonly TextHighlight[],
  next: TextHighlight,
): TextHighlight[] {
  const normalized = validHighlights(text, [{
    ...next,
    color: normalizeHighlightColor(next.color),
  }])
  if (normalized.length === 0) return validHighlights(text, highlights)
  return sortHighlights([
    ...clearHighlightRange(text, highlights, next),
    normalized[0],
  ])
}

export function rangeFromWordHits(
  anchor: WordHitBox | null,
  focus: WordHitBox | null,
): Pick<TextHighlight, "segmentIndex" | "start" | "end"> | null {
  if (!anchor || !focus || anchor.segmentIndex !== focus.segmentIndex) return null
  return {
    segmentIndex: anchor.segmentIndex,
    start: Math.min(anchor.start, focus.start),
    end: Math.max(anchor.end, focus.end),
  }
}

function distanceToWord(hit: WordHitBox, x: number, y: number) {
  return {
    x: Math.max(hit.x - x, 0, x - hit.x - hit.width),
    y: Math.max(hit.y - y, 0, y - hit.y - hit.height),
  }
}

export function wordHitAtPoint(
  hits: readonly WordHitBox[],
  x: number,
  y: number,
  tolerance = 0,
): WordHitBox | null {
  let closest: WordHitBox | null = null
  let distance = Number.POSITIVE_INFINITY
  for (const hit of hits) {
    const delta = distanceToWord(hit, x, y)
    const nextDistance = Math.hypot(delta.x, delta.y)
    if (nextDistance <= tolerance && nextDistance < distance) {
      closest = hit
      distance = nextDistance
    }
  }
  return closest
}

/** During a drag, follow the nearest line and clamp past its first/last word. */
export function nearestWordHitAtPoint(
  hits: readonly WordHitBox[],
  x: number,
  y: number,
): WordHitBox | null {
  if (hits.length === 0 || !Number.isFinite(x) || !Number.isFinite(y)) return null
  if (y < Math.min(...hits.map((hit) => hit.y))) return hits[0]
  if (y > Math.max(...hits.map((hit) => hit.y + hit.height))) return hits[hits.length - 1]
  let closest: WordHitBox | null = null
  let vertical = Number.POSITIVE_INFINITY
  let horizontal = Number.POSITIVE_INFINITY
  for (const hit of hits) {
    const delta = distanceToWord(hit, x, y)
    if (delta.y < vertical || (delta.y === vertical && delta.x < horizontal)) {
      closest = hit
      vertical = delta.y
      horizontal = delta.x
    }
  }
  return closest
}
