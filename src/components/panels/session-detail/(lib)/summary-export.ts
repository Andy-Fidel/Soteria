import { formatSummaryAsMarkdown, type SermonSummary } from "@/lib/summarize"
import { buildSessionExportSlug } from "@/lib/session-export"
import { saveTextExport } from "./save-export"
import { printSummary } from "./summary-print"
import { quoteSpeaker } from "./summary"

export type SummaryExportFormat = "clipboard" | "markdown" | "print"

export async function exportSummary(
  format: SummaryExportFormat,
  summary: SermonSummary,
  speaker?: string | null
) {
  if (format === "print") {
    await printSummary(summary, speaker)
    return true
  }
  const markdown = formatSummaryAsMarkdown({
    ...summary,
    quotes: summary.quotes.map((quote) => ({
      ...quote,
      speaker: quoteSpeaker(quote.speaker, speaker),
    })),
  })
  if (format === "clipboard") {
    await navigator.clipboard.writeText(markdown)
    return true
  }
  return saveTextExport(
    markdown,
    `${buildSessionExportSlug(summary.title)}-summary.md`,
    {
      name: "Markdown",
      extensions: ["md"],
    }
  )
}
