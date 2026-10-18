import type { SermonSummary } from "@/lib/summarize"
export function hasText(value: string | null | undefined) {
  return Boolean(value?.trim())
}

export function quoteSpeaker(
  quoteSpeaker: string | undefined,
  sessionSpeaker: string | null | undefined
) {
  return quoteSpeaker?.trim() || sessionSpeaker?.trim() || "Pastor"
}

export function hasSermonFlow(summary: SermonSummary) {
  const flow = summary.sermon_flow
  return (
    hasText(flow.opening) ||
    flow.main_points.length > 0 ||
    hasText(flow.conclusion) ||
    hasText(flow.response)
  )
}

export function hasDevotional(summary: SermonSummary) {
  const devotional = summary.devotional
  return (
    hasText(devotional.scripture) ||
    hasText(devotional.observation) ||
    hasText(devotional.application) ||
    hasText(devotional.prayer) ||
    devotional.reflection_questions.length > 0
  )
}
