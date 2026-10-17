/** Each span links captured wall-clock time to its place in the merged MP3. */
export interface SessionAudioSpan {
  wallStartMs: number | null
  wallEndMs: number | null
  audioStartMs: number
  durationMs: number
}

/** Pauses have no audio. Seek to the next recorded span when time falls in a gap. */
export function sessionAudioSeekSeconds(
  timestampMs: number,
  startedAtMs: number,
  spans: SessionAudioSpan[],
  durationSeconds = Number.POSITIVE_INFINITY
): number | null {
  if (!Number.isFinite(timestampMs)) return null
  const known = spans.filter(
    (span) =>
      span.wallStartMs !== null &&
      span.wallEndMs !== null &&
      Number.isFinite(span.wallStartMs) &&
      Number.isFinite(span.wallEndMs) &&
      Number.isFinite(span.audioStartMs) &&
      Number.isFinite(span.durationMs) &&
      span.durationMs >= 0
  )
  const clamp = (milliseconds: number) => {
    if (!Number.isFinite(milliseconds)) return null
    return Math.min(
      Math.max(0, milliseconds / 1000),
      Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : Infinity
    )
  }
  // Existing recordings have no provenance and retain their original behavior.
  if (known.length === 0) return clamp(timestampMs - startedAtMs)

  let previous: SessionAudioSpan | undefined
  for (const span of known) {
    const start = span.wallStartMs!
    const end = span.wallEndMs!
    if (timestampMs < start) {
      // A legacy recording can precede newly recorded segments in the same file.
      if (!previous && span.audioStartMs > 0) {
        return clamp(Math.min(timestampMs - startedAtMs, span.audioStartMs))
      }
      return clamp(span.audioStartMs)
    }
    if (timestampMs <= end) {
      return clamp(
        span.audioStartMs + Math.min(timestampMs - start, span.durationMs)
      )
    }
    previous = span
  }
  const last = known[known.length - 1]
  return clamp(last.audioStartMs + last.durationMs)
}
