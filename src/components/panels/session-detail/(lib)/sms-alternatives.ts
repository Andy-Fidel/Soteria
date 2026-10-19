import { smsMetrics } from "./sharing-drafts"
export const SMS_APPROACHES = ["encouragement", "reflection", "action"] as const
export interface SmsAlternative {
  approach: (typeof SMS_APPROACHES)[number]
  message: string
}
export function parseSmsAlternatives(value: unknown): SmsAlternative[] {
  if (!Array.isArray(value) || value.length !== 3)
    throw new Error("Expected three SMS alternatives. Try again.")
  const messages = new Set<string>()
  return SMS_APPROACHES.map((approach) => {
    const item = value.find((item) => item?.approach === approach)
    if (
      typeof item?.message !== "string" ||
      !item.message.trim() ||
      smsMetrics(item.message).segments !== 1
    )
      throw new Error("An SMS alternative is invalid or too long. Try again.")
    const normalized = item.message.trim().replace(/\s+/g, " ").toLowerCase()
    if (messages.has(normalized))
      throw new Error(
        "The SMS alternatives repeated the same wording. Try again."
      )
    messages.add(normalized)
    return { approach, message: item.message }
  })
}
