import { beforeEach, expect, it, vi } from "vitest"
import { invoke } from "@tauri-apps/api/core"
import { useSettingsStore } from "@/stores/settings-store"
import { generateAndPersistSummary } from "./summarize"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))
vi.mock("@tauri-apps/plugin-store", () => ({ load: vi.fn() }))

beforeEach(() => {
  vi.restoreAllMocks()
  vi.mocked(invoke).mockReset()
  useSettingsStore.setState({ deepseekApiKey: "test-key" })
})

it("keeps the existing saved summary when summary generation fails", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {})
  const commands: string[] = []
  vi.mocked(invoke).mockImplementation(async (command) => {
    commands.push(command)
    if (command === "get_session_transcript")
      return [{ text: "Original teaching and closing prayer" }]
    if (command === "get_session_detections") return []
    if (command === "summarize_sermon")
      throw new Error("DeepSeek returned incomplete summary JSON after retry")
    throw new Error(`Unexpected write command: ${command}`)
  })
  expect(await generateAndPersistSummary(42)).toBeNull()
  expect(commands).toEqual([
    "get_session_transcript",
    "get_session_detections",
    "summarize_sermon",
  ])
})

it("saves only the summary and leaves every original transcript segment unchanged", async () => {
  const transcript = Object.freeze([
    Object.freeze({
      id: 1,
      text: "Silver rivers of gladness\nwe sing 🙏",
      timestampMs: 10,
    }),
    Object.freeze({
      id: 2,
      text: "Forgive your neighbour — today.",
      timestampMs: 20,
    }),
  ])
  const original = JSON.stringify(transcript)
  const commands: string[] = []
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    commands.push(command)
    if (command === "get_session_transcript") return transcript
    if (command === "get_session_detections") return []
    if (command === "summarize_sermon") {
      expect(args).toMatchObject({
        transcript:
          "Silver rivers of gladness\nwe sing 🙏 Forgive your neighbour — today.",
      })
      return JSON.stringify({
        session_content: "mixed",
        title: "Forgive your neighbour",
      })
    }
    if (command === "update_session_summary") {
      const payload = args as { id: number; summary: string }
      expect(payload.id).toBe(42)
      expect(JSON.parse(payload.summary)).toMatchObject({
        session_content: "mixed",
        title: "Forgive your neighbour",
      })
      return undefined
    }
    throw new Error(`Unexpected database or service command: ${command}`)
  })
  const result = await generateAndPersistSummary(42)
  expect(result?.title).toBe("Forgive your neighbour")
  expect(JSON.stringify(transcript)).toBe(original)
  expect(commands).toEqual([
    "get_session_transcript",
    "get_session_detections",
    "summarize_sermon",
    "update_session_summary",
  ])
})
