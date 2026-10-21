import { load } from "cheerio"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseSummary } from "@/lib/summarize"
import { buildSummaryPrintHtml, printSummary } from "./summary-print"
import { invoke, isTauri } from "@tauri-apps/api/core"

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => false),
}))

afterEach(() => vi.unstubAllGlobals())

describe("summary print document", () => {
  it("includes all summary sections and preserves Unicode as text", () => {
    const summary = parseSummary(
      JSON.stringify({
        title: "Hope <script>alert(1)</script>",
        big_idea: "God’s love — χάρις",
        takeaways: ["Keep hoping"],
        key_verses: [{ reference: "John 3:16", reason: "Our passage" }],
        sermon_flow: {
          opening: "Opening",
          main_points: [
            {
              point: "Point",
              explanation: "Explanation",
              scripture_refs: ["Psalm 23"],
              illustration_or_moment: "Story",
              application: "Action",
            },
          ],
          conclusion: "Conclusion",
          response: "Response",
        },
        devotional: {
          scripture: "Scripture",
          observation: "Observation",
          application: "Application",
          prayer: "Prayer",
          reflection_questions: ["Question?"],
        },
        quotes: [{ text: "A quote" }],
      })
    )
    const $ = load(buildSummaryPrintHtml(summary, "Pastor <Kennedy>"))
    expect($("script")).toHaveLength(0)
    expect($("h1").text()).toBe("Hope <script>alert(1)</script>")
    for (const text of [
      "God’s love — χάρις",
      "Keep hoping",
      "Our passage",
      "Opening",
      "Point",
      "Explanation",
      "Psalm 23",
      "Story",
      "Action",
      "Conclusion",
      "Response",
      "Observation",
      "Application",
      "Prayer",
      "Question?",
      "A quote",
      "Pastor <Kennedy>",
    ]) {
      expect($.text()).toContain(text)
    }
    expect($.text()).not.toContain("undefined")
  })

  it("does not invent sermon sections for worship-only sessions", () => {
    const summary = parseSummary(JSON.stringify({ session_content: "worship" }))
    const $ = load(buildSummaryPrintHtml(summary))
    expect($.text()).toContain("Worship session")
    expect(
      $("h2")
        .map((_, el) => $(el).text())
        .get()
    ).not.toContain("Sermon outline")
    expect($.text()).not.toContain("undefined")
  })

  it("prints the full document and removes it when the print dialog closes", () => {
    const summary = parseSummary(
      JSON.stringify({ title: "Printable teaching" })
    )
    const root = { id: "", innerHTML: "", remove: vi.fn() }
    const append = vi.fn()
    const print = vi.fn(() => {
      expect(append).toHaveBeenCalledWith(root)
      expect(root.innerHTML).toContain("Printable teaching")
    })
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    vi.stubGlobal("document", {
      getElementById: () => null,
      createElement: () => root,
      body: { append },
    })
    vi.stubGlobal("window", { print, addEventListener, removeEventListener })
    printSummary(summary)
    expect(print).toHaveBeenCalledOnce()
    expect(root.remove).not.toHaveBeenCalled()
    const cleanup = addEventListener.mock.calls[0][1]
    cleanup()
    expect(root.remove).toHaveBeenCalledOnce()
    expect(removeEventListener).toHaveBeenCalledWith("afterprint", cleanup)
  })

  it("cleans up and reports print failures", async () => {
    const root = { id: "", innerHTML: "", remove: vi.fn() }
    vi.stubGlobal("document", {
      getElementById: () => null,
      createElement: () => root,
      body: { append: vi.fn() },
    })
    vi.stubGlobal("window", {
      print: () => {
        throw new Error("Printer unavailable")
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    await expect(printSummary(parseSummary("{}"))).rejects.toThrow(
      "Printer unavailable"
    )
    expect(root.remove).toHaveBeenCalledOnce()
  })

  it("opens the native print dialog on macOS instead of using the no-op JavaScript call", async () => {
    const root = { id: "", innerHTML: "", remove: vi.fn() }
    const print = vi.fn()
    vi.stubGlobal("document", {
      getElementById: () => null,
      createElement: () => root,
      body: { append: vi.fn() },
    })
    vi.stubGlobal("window", {
      print,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X)",
    })
    vi.mocked(isTauri).mockReturnValue(true)
    vi.mocked(invoke).mockResolvedValue(undefined)
    await printSummary(parseSummary("{}"))
    expect(invoke).toHaveBeenCalledWith("print_summary")
    expect(print).not.toHaveBeenCalled()
    vi.mocked(isTauri).mockReturnValue(false)
  })

  it("removes an orphaned print document so repeated exports cannot duplicate pages", async () => {
    const orphan = { remove: vi.fn() }
    const root = { id: "", innerHTML: "", remove: vi.fn() }
    vi.stubGlobal("document", {
      getElementById: (id: string) =>
        id === "manna-summary-print-root" ? orphan : null,
      createElement: () => root,
      body: { append: vi.fn() },
    })
    const listeners = new Map<string, () => void>()
    vi.stubGlobal("window", {
      print: vi.fn(),
      addEventListener: (name: string, callback: () => void) =>
        listeners.set(name, callback),
      removeEventListener: vi.fn(),
    })
    await printSummary(parseSummary("{}"))
    expect(orphan.remove).toHaveBeenCalledOnce()
    listeners.get("afterprint")?.()
  })
})
