export interface CommsSettings {
  configured: boolean
  senderId: string
  contactListId: string
}
export interface SmsRecipient {
  phone: string
  key: string
  status: string
  messageId: string | null
  error: string | null
}
export interface SmsBatch {
  id: string
  sessionId: number
  message: string
  senderId: string
  createdAt: number
  estimatedCost: number
  currency: string
  segments: number
  recipients: SmsRecipient[]
}
export function parseTestNumbers(text: string) {
  const numbers: string[] = []
  const invalid: string[] = []
  let duplicates = 0
  for (const raw of text
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)) {
    let number = raw.replace(/[\s()-]/g, "").replace(/^\+/, "")
    if (/^0\d{9}$/.test(number)) number = `233${number.slice(1)}`
    if (!/^233[1-9]\d{8}$/.test(number)) invalid.push(raw)
    else if (numbers.includes(number)) duplicates++
    else numbers.push(number)
  }
  return { numbers, invalid, duplicates }
}
export function canSendBatch(recipients: Pick<SmsRecipient, "status">[]) {
  return recipients.some(
    ({ status }) => status === "PREVIEWED" || status === "UNKNOWN"
  )
}
export function smsStatus(status: string) {
  return (
    (
      {
        PREVIEWED: "Ready",
        UNKNOWN: "Outcome unknown",
        QUEUED: "Queued",
        DISPATCHED: "Dispatched",
        DELIVERED: "Delivered",
        FAILED: "Failed",
        REJECTED: "Not sent",
      } as Record<string, string>
    )[status] ?? status
  )
}
