export interface SessionPublication {
  id: string
  url: string | null
  publishedAt: string | null
}
export function attachSermonLink(sms: string, url: string) {
  const takeaway = sms
    .replace(/https:\/\/sermon\.ewcadenta\.com\/s\/[a-f0-9]+/gi, "")
    .trim()
  return takeaway ? `${takeaway} ${url}` : url
}
