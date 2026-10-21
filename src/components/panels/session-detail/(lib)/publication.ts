export interface SessionPublication {
  id: string
  url: string | null
  publishedAt: string | null
}
export function canonicalSermonLinks(text: string) {
  return text.replace(
    /https:\/\/sermon\.ewcadenta\.com(?=\/s\/[a-f0-9]{16}\b)/gi,
    "https://sermon.ewcadentan.com"
  )
}
export const SERMON_SMS_INVITATION = "Read this week's sermon recap:"

export function attachSermonLink(sms: string, url: string) {
  const takeaway = sms
    .replace(/https:\/\/sermon\.ewcadentan?\.com\/s\/[a-f0-9]+/gi, "")
    .trim()
    .replace(/(?:\s*Read this week['’]s (?:sermon )?recap:\s*)+$/i, "")
    .trim()
  const canonical = canonicalSermonLinks(url)
  const invitation = `${SERMON_SMS_INVITATION}\n${canonical}`
  return takeaway ? `${takeaway}\n\n${invitation}` : invitation
}

/** Separate the takeaway from the invitation, with the link directly below it. */
export function formatSermonSms(sms: string) {
  const links = sms.match(
    /https:\/\/sermon\.ewcadentan?\.com\/s\/[a-f0-9]{16}\b/gi
  )
  return links?.length ? attachSermonLink(sms, links[links.length - 1]) : sms
}
