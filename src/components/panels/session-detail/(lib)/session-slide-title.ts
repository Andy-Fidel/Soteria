import type { SermonSession } from "@/types/session"

// Recognize the app's dated session labels, including older rows marked manual.
function isDatedSessionName(title: string) {
  return /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s.+\d{4}\s*[—–-]\s*\d{1,2}:\d{2}/i.test(
    title.trim()
  )
}

/** Resolve artwork text without renaming the session or changing saved slides. */
export function sessionSlideTitle(
  session: Pick<SermonSession, "title" | "titleSource"> | null,
  fallback: string,
  recapTitle?: string,
  summaryTitle?: string
) {
  const name = session?.title.trim() || fallback.trim()
  if (session?.titleSource !== "default" && name && !isDatedSessionName(name))
    return name
  for (const title of [recapTitle, summaryTitle]) {
    const value = title?.trim()
    if (value && value !== name && !isDatedSessionName(value)) return value
  }
  return name
}
