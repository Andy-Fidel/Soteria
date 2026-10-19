import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { parseSummary } from "@/lib/summarize"
import { exportSummary } from "./summary-export"
import { saveTextExport } from "./save-export"
import { printSummary } from "./summary-print"

vi.mock("./save-export", () => ({ saveTextExport: vi.fn() }))
vi.mock("./summary-print", () => ({ printSummary: vi.fn() }))

const summary = parseSummary(
  JSON.stringify({
    title: "Faith & hope",
    big_idea: "Stay faithful",
    sermon_flow: {
      main_points: [
        { point: "Hidden point", explanation: "Include collapsed details" },
      ],
    },
    quotes: [{ text: "Keep going" }],
  })
)
const writeText = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("navigator", { clipboard: { writeText } })
  writeText.mockResolvedValue(undefined)
  vi.mocked(saveTextExport).mockResolvedValue(true)
})
afterEach(() => vi.unstubAllGlobals())

describe("summary exports", () => {
  it("copies the full summary without exporting the session transcript", async () => {
    expect(await exportSummary("clipboard", summary)).toBe(true)
    expect(writeText).toHaveBeenCalledOnce()
    const content = writeText.mock.calls[0][0]
    expect(content).toContain("# Faith & hope")
    expect(content).toContain("Include collapsed details")
    expect(content).toContain("Keep going")
    expect(content).not.toContain("## Transcript")
    expect(saveTextExport).not.toHaveBeenCalled()
    expect(printSummary).not.toHaveBeenCalled()
  })

  it("saves the same complete content as a Markdown file", async () => {
    expect(await exportSummary("markdown", summary)).toBe(true)
    expect(saveTextExport).toHaveBeenCalledWith(
      expect.stringContaining("Include collapsed details"),
      "faith-hope-summary.md",
      { name: "Markdown", extensions: ["md"] }
    )
    expect(writeText).not.toHaveBeenCalled()
  })

  it("does not report a canceled save as successful", async () => {
    vi.mocked(saveTextExport).mockResolvedValue(false)
    expect(await exportSummary("markdown", summary)).toBe(false)
  })

  it("passes the summary and speaker to the print document", async () => {
    expect(await exportSummary("print", summary, "Pastor Kennedy")).toBe(true)
    expect(printSummary).toHaveBeenCalledWith(summary, "Pastor Kennedy")
    expect(saveTextExport).not.toHaveBeenCalled()
  })

  it("uses the displayed speaker attribution without changing the saved summary", async () => {
    const withoutSpeaker = { ...summary, quotes: [{ text: "Keep going" }] }
    const before = JSON.stringify(withoutSpeaker)
    await exportSummary("clipboard", withoutSpeaker, "Pastor Kennedy")
    expect(writeText.mock.calls[0][0]).toContain("— Pastor Kennedy")
    expect(JSON.stringify(withoutSpeaker)).toBe(before)
  })

  it("reports clipboard and file failures to the caller", async () => {
    writeText.mockRejectedValue(new Error("Clipboard denied"))
    await expect(exportSummary("clipboard", summary)).rejects.toThrow(
      "Clipboard denied"
    )
    vi.mocked(saveTextExport).mockRejectedValue(new Error("Disk full"))
    await expect(exportSummary("markdown", summary)).rejects.toThrow(
      "Disk full"
    )
  })
})
