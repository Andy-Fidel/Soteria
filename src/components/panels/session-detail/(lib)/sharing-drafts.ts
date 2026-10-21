export interface SharingDraft {
  title: string
  recap: string
  sms: string
}
export const EMPTY_SHARING_DRAFT: SharingDraft = {
  title: "",
  recap: "",
  sms: "",
}

const GSM_BASIC = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
  )
)
const GSM_EXTENDED = new Set(Array.from("\f^{}\\[~]|€"))

export function smsMetrics(text: string) {
  const characters = Array.from(text)
  const gsm = characters.every(
    (char) => GSM_BASIC.has(char) || GSM_EXTENDED.has(char)
  )
  const units = gsm
    ? characters.reduce(
        (sum, char) => sum + (GSM_EXTENDED.has(char) ? 2 : 1),
        0
      )
    : text.length
  const limit = gsm ? 160 : 70
  const multipartLimit = gsm ? 153 : 67
  return {
    encoding: gsm ? "GSM-7" : "Unicode",
    units,
    limit,
    remaining: Math.max(0, limit - units),
    segments:
      units === 0 ? 0 : units <= limit ? 1 : Math.ceil(units / multipartLimit),
  }
}

export function parseSharingDraft(raw: string): SharingDraft {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== "object")
    throw new Error("Draft response was invalid. Try generating again.")
  const draft = value as Record<string, unknown>
  for (const field of ["title", "recap", "sms"] as const) {
    if (typeof draft[field] !== "string" || !draft[field].trim())
      throw new Error("Draft response was incomplete. Try generating again.")
  }
  return {
    title: String(draft.title).trim(),
    recap: String(draft.recap).trim(),
    sms: String(draft.sms).trim(),
  }
}
