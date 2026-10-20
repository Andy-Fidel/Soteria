import { formatAudioTime } from "@/lib/session-audio-timeline"
export interface PreparedAudio {
  revision: string
  startSeconds: number
  endSeconds: number
  durationSeconds: number
  bytes: number
}
export interface SermonAudioInfo {
  durationSeconds: number
  prepared: PreparedAudio | null
}
export type AudioPublicationState =
  | { mode: "excluded" }
  | { mode: "included"; revision: string }
  | { mode: "busy" }
export function parseAudioTime(value: string) {
  const parts = value.trim().split(":")
  if (
    parts.length < 1 ||
    parts.length > 3 ||
    parts.some((part) => !/^\d+(\.\d+)?$/.test(part))
  )
    return null
  if (parts.length > 1 && parts.slice(1).some((part) => Number(part) >= 60))
    return null
  const seconds = parts.reduce((sum, part) => sum * 60 + Number(part), 0)
  return Number.isFinite(seconds) ? seconds : null
}
export function validAudioCut(
  start: number | null,
  end: number | null,
  duration: number
) {
  return (
    start !== null &&
    end !== null &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start >= 0 &&
    end <= duration &&
    end - start >= 3
  )
}

export function formatCutTime(seconds: number) {
  const milliseconds = Math.floor((seconds - Math.floor(seconds)) * 1000)
  return (
    formatAudioTime(seconds) +
    (milliseconds
      ? `.${String(milliseconds).padStart(3, "0").replace(/0+$/, "")}`
      : "")
  )
}
