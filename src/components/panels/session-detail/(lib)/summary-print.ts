import { hasSermonContent, type SermonSummary } from "@/lib/summarize"
import { hasText, quoteSpeaker } from "./summary"
import { invoke, isTauri } from "@tauri-apps/api/core"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>")
}

function field(label: string, value: string) {
  return hasText(value) ? `<h3>${label}</h3><p>${escapeHtml(value)}</p>` : ""
}

function section(label: string, content: string) {
  return content ? `<section><h2>${label}</h2>${content}</section>` : ""
}

function list(items: string[]) {
  return items.length
    ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : ""
}

export function buildSummaryPrintHtml(
  summary: SermonSummary,
  speaker?: string | null
) {
  const header = `<header><h1>${escapeHtml(summary.title)}</h1>${hasText(speaker) ? `<p>${escapeHtml(speaker!)}</p>` : ""}</header>`
  const mainMessage = section(
    hasSermonContent(summary) ? "The main message" : "Session summary",
    hasText(summary.big_idea) ? `<p>${escapeHtml(summary.big_idea)}</p>` : ""
  )
  if (!hasSermonContent(summary))
    return `<article>${header}${mainMessage}</article>`

  const flow = summary.sermon_flow
  const points = flow.main_points
    .map(
      (point, index) => `<div class="summary-print-point">
    <h3>${index + 1}. ${escapeHtml(point.point)}</h3>
    ${hasText(point.explanation) ? `<p>${escapeHtml(point.explanation)}</p>` : ""}
    ${point.scripture_refs.length ? field("Scriptures", point.scripture_refs.join(", ")) : ""}
    ${field("Illustration", point.illustration_or_moment)}
    ${field("Put it into practice", point.application)}
  </div>`
    )
    .join("")
  const outline = section(
    "Sermon outline",
    field("Opening", flow.opening) +
      points +
      field("Conclusion", flow.conclusion) +
      field("Response", flow.response)
  )
  const verses = section(
    "Key scriptures",
    summary.key_verses
      .map(
        (verse) =>
          `<div>${field(escapeHtml(verse.reference), verse.reason || verse.reference)}</div>`
      )
      .join("")
  )
  const devotional = summary.devotional
  const reflection = section(
    "Take it into your week",
    field("Scripture", devotional.scripture) +
      field("Consider", devotional.observation) +
      field("Respond", devotional.application) +
      section(
        "Questions for reflection",
        list(devotional.reflection_questions)
      ) +
      field("Prayer", devotional.prayer)
  )
  const quotes = section(
    "Words to remember",
    summary.quotes
      .map(
        (quote) =>
          `<blockquote><p>“${escapeHtml(quote.text)}”</p><cite>${escapeHtml(quoteSpeaker(quote.speaker, speaker))}</cite></blockquote>`
      )
      .join("")
  )
  return `<article>${header}${mainMessage}${section("Carry these with you", list(summary.takeaways))}${outline}${verses}${reflection}${quotes}<footer>AI-generated summary. Review alongside the original transcript.</footer></article>`
}

let cleanupPreviousPrint: (() => void) | undefined

export async function printSummary(
  summary: SermonSummary,
  speaker?: string | null
) {
  cleanupPreviousPrint?.()
  document.getElementById("manna-summary-print-root")?.remove()
  const root = document.createElement("div")
  root.id = "manna-summary-print-root"
  root.innerHTML = `<style>
    #manna-summary-print-root { display: none; }
    @media print {
      @page { size: A4; margin: 14mm; }
      html, body { height: auto !important; overflow: visible !important; background: white !important; }
      body > :not(#manna-summary-print-root) { display: none !important; }
      #manna-summary-print-root { display: block !important; color: #111; font: 9.5pt/1.35 system-ui, sans-serif; overflow-wrap: anywhere; }
      #manna-summary-print-root article { max-width: none; }
      #manna-summary-print-root h1 { font-size: 21pt; line-height: 1.15; margin: 0 0 9pt; }
      #manna-summary-print-root h2 { font-size: 12pt; margin: 14pt 0 6pt; }
      #manna-summary-print-root h3 { font-size: 9.5pt; font-weight: bold; margin: 8pt 0 3pt; }
      #manna-summary-print-root h1, #manna-summary-print-root h2, #manna-summary-print-root h3 { break-after: avoid; }
      #manna-summary-print-root p { margin: 0 0 6pt; orphans: 2; widows: 2; }
      #manna-summary-print-root ul { list-style: disc; padding-left: 17pt; margin: 5pt 0; }
      #manna-summary-print-root li { margin: 3pt 0; }
      #manna-summary-print-root blockquote { border-left: 1pt solid #aaa; padding-left: 9pt; margin: 9pt 0; }
      #manna-summary-print-root cite, #manna-summary-print-root footer { font-size: 8pt; color: #444; }
      #manna-summary-print-root footer { margin-top: 14pt; }
    }
  </style>${buildSummaryPrintHtml(summary, speaker)}`
  const cleanup = () => {
    root.remove()
    window.removeEventListener("afterprint", cleanup)
    if (cleanupPreviousPrint === cleanup) cleanupPreviousPrint = undefined
  }
  cleanupPreviousPrint = cleanup
  window.addEventListener("afterprint", cleanup, { once: true })
  document.body.append(root)
  try {
    // WKWebView does not open a print dialog for the JavaScript print call.
    if (isTauri() && navigator.userAgent.includes("Mac")) {
      await invoke("print_summary")
    } else {
      window.print()
    }
  } catch (error) {
    cleanup()
    throw error
  }
}
