import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { parseSummary } from "@/lib/summarize"
import { SummaryTab } from "./summary-tab"

const props = {
  summary: null,
  summarizing: false,
  summaryError: null,
  summaryCopied: false,
  transcript: [],
  session: { speaker: "Session speaker" },
  handleSummarize: () => {},
  handleCopySummary: () => {},
}

describe("session summary tab", () => {
  it("shows a worship session without invented sermon sections or sermon-only labels", () => {
    const summary = parseSummary(JSON.stringify({ session_content: "worship" }))
    const html = renderToStaticMarkup(
      <SummaryTab {...props} summary={summary} />
    )
    expect(html).toContain("Worship session")
    expect(html).toContain("No sermon teaching")
    expect(html).not.toContain("Sermon Flow")
    expect(html).not.toContain("Big Idea")
    expect(html).not.toContain("from this sermon")
  })
  it("renders every rich summary section after extraction", () => {
    const summary = parseSummary(
      JSON.stringify({
        title: "A sure hope",
        big_idea: "Our anchor holds",
        key_verses: [
          { reference: "Hebrews 6:19", reason: "Our anchor passage" },
        ],
        sermon_flow: {
          opening: "Opening story",
          main_points: [
            {
              point: "Trust the anchor",
              explanation: "An explanation",
              scripture_refs: ["Romans 5:5"],
              illustration_or_moment: "The anchor illustration",
              application: "Pray today",
            },
          ],
          conclusion: "Closing encouragement",
          response: "Trust again",
        },
        takeaways: ["Keep hoping"],
        devotional: {
          scripture: "Psalm 23",
          observation: "God leads us",
          application: "Follow today",
          prayer: "Lord, lead me",
          reflection_questions: ["Where can I follow?"],
        },
        quotes: [{ text: "Hope holds us", speaker: "Quoted speaker" }],
      })
    )
    const html = renderToStaticMarkup(
      <SummaryTab {...props} summary={summary} />
    )
    for (const text of [
      "A sure hope",
      "Our anchor holds",
      "Hebrews 6:19",
      "Our anchor passage",
      "Opening story",
      "Trust the anchor",
      "An explanation",
      "Romans 5:5",
      "The anchor illustration",
      "Pray today",
      "Closing encouragement",
      "Trust again",
      "Keep hoping",
      "Psalm 23",
      "God leads us",
      "Follow today",
      "Lord, lead me",
      "Where can I follow?",
      "Hope holds us",
      "Quoted speaker",
    ]) {
      expect(html).toContain(text)
    }
    expect(html).toContain("Copy summary as markdown")
    expect(html).toContain("Regenerate")
  })

  it("keeps the empty, loading, and retry states", () => {
    expect(renderToStaticMarkup(<SummaryTab {...props} />)).toContain(
      "Record some transcript first."
    )
    expect(
      renderToStaticMarkup(<SummaryTab {...props} summarizing />)
    ).toContain("Summarizing transcript")
    const error = renderToStaticMarkup(
      <SummaryTab {...props} summaryError="Service unavailable" />
    )
    expect(error).toContain("Service unavailable")
    expect(error).toContain("Retry")
  })
})
