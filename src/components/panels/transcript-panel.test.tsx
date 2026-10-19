// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { TranscriptPanel } from "./transcript-panel"
import { useTranscriptStore } from "@/stores/transcript-store"
import { useSessionStore } from "@/stores/session-store"
import { useSettingsStore } from "@/stores/settings-store"
import type { TranscriptSegment } from "@/types"

const native = vi.hoisted(() => ({
  listeners: new Map<string, (event: { payload: unknown }) => unknown>(),
  invoke: vi.fn(),
}))
vi.mock("@tauri-apps/api/core", async (original) => ({
  ...(await original<typeof import("@tauri-apps/api/core")>()),
  invoke: native.invoke,
}))
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    async (
      name: string,
      callback: (event: { payload: unknown }) => unknown
    ) => {
      native.listeners.set(name, callback)
      return () => native.listeners.delete(name)
    }
  ),
  emit: vi.fn(),
  emitTo: vi.fn(),
}))

let container: HTMLDivElement
let root: Root

function segment(id: string, text: string): TranscriptSegment {
  return {
    id,
    text,
    is_final: true,
    confidence: 0.9,
    words: [],
    timestamp: 1000,
  }
}
async function mount() {
  await act(async () => {
    root.render(<TranscriptPanel />)
  })
}
async function event(name: string, text = "") {
  await act(async () => {
    await native.listeners.get(name)?.({
      payload: { text, is_final: name === "transcript_final", confidence: 0.9 },
    })
  })
}
function scrollArea() {
  return container.querySelector<HTMLElement>(".overflow-y-auto")!
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  native.listeners.clear()
  native.invoke.mockReset().mockResolvedValue(false)
  useTranscriptStore.setState({
    segments: [],
    currentPartial: "",
    isTranscribing: false,
    connectionStatus: "disconnected",
    transcribingStartedAt: null,
  })
  useSessionStore.setState({ activeSession: null })
  useSettingsStore.setState({ recordAudio: true, autoMode: false })
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
  native.listeners.clear()
})

it("does not process completed text again when only the live sentence changes", async () => {
  let reads = 0
  const saved = segment("saved", "Completed words remain available")
  Object.defineProperty(saved, "text", {
    get: () => {
      reads++
      return "Completed words remain available"
    },
  })
  useTranscriptStore.setState({ segments: [saved], isTranscribing: true })
  await mount()
  const initialReads = reads
  expect(initialReads).toBeGreaterThan(0)
  await event("transcript_partial", "New live words")
  await event("transcript_partial", "More new live words")
  expect(container.textContent).toContain("Completed words remain available")
  expect(container.textContent).toContain("More new live words")
  expect(reads).toBe(initialReads)
})

it("replaces partial text, appends final text once, and keeps the original completed lines", async () => {
  useTranscriptStore.setState({
    segments: [segment("saved", "An earlier sentence")],
    isTranscribing: true,
  })
  await mount()
  const saved = useTranscriptStore.getState().segments
  await event("transcript_partial", "First partial words")
  await event("transcript_partial", "Replacement partial words")
  expect(useTranscriptStore.getState().segments).toBe(saved)
  expect(container.textContent).not.toContain("First partial words")
  await event("transcript_final", "A finished sentence")
  expect(useTranscriptStore.getState().currentPartial).toBe("")
  expect(container.querySelectorAll("p.text-sm")).toHaveLength(2)
  expect(container.textContent).not.toContain("Replacement partial words")
  expect(container.textContent).toContain("A finished sentence")
  expect(container.textContent).toContain("An earlier sentence")
})

it("scrolls on partial and final updates, including a final with no preceding partial", async () => {
  await mount()
  const scroll = scrollArea()
  // jsdom has no layout engine. Real layout is checked in the browser benchmark.
  Object.defineProperty(scroll, "scrollHeight", {
    configurable: true,
    get: () => 2000,
  })
  await event("transcript_partial", "Live sentence")
  expect(scroll.scrollTop).toBe(2000)
  scroll.scrollTop = 0
  await event("transcript_final", "First finished sentence")
  expect(scroll.scrollTop).toBe(2000)
  scroll.scrollTop = 0
  await event("transcript_final", "Another finished sentence")
  expect(scroll.scrollTop).toBe(2000)
})

it("keeps all long-session lines available and clears both saved and partial text", async () => {
  useTranscriptStore.setState({
    segments: Array.from({ length: 2000 }, (_, i) =>
      segment(`line-${i}`, `Generated sentence ${i}`)
    ),
  })
  await mount()
  expect(container.querySelectorAll("p.text-sm")).toHaveLength(2000)
  expect(container.textContent).toContain("Generated sentence 0")
  expect(container.textContent).toContain("Generated sentence 1999")
  await event("transcript_partial", "An unfinished sentence")
  await act(async () => {
    useTranscriptStore.getState().clearTranscript()
  })
  expect(container.querySelectorAll("p.text-sm")).toHaveLength(0)
  expect(container.textContent).not.toContain("An unfinished sentence")
  expect(container.textContent).toContain("No transcript yet")
})

it("preserves completed text through a connection interruption and accepts resumed live text", async () => {
  useTranscriptStore.setState({
    segments: [segment("saved", "Keep this completed sentence")],
  })
  await mount()
  await event("stt_connected")
  await event("transcript_partial", "Interrupted words")
  await event("stt_disconnected")
  expect(useTranscriptStore.getState().currentPartial).toBe("")
  expect(container.textContent).toContain("Keep this completed sentence")
  await event("stt_connected")
  await event("transcript_partial", "Resumed live words")
  expect(container.textContent).toContain("Resumed live words")
})

it("keeps pause and resume audio controls working", async () => {
  await mount()
  await event("stt_connected")
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>('button[title="Pause recording"]')!
      .click()
  })
  expect(native.invoke).toHaveBeenCalledWith("set_recording_paused", {
    paused: true,
  })
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>('button[title="Resume recording"]')!
      .click()
  })
  expect(native.invoke).toHaveBeenCalledWith("set_recording_paused", {
    paused: false,
  })
})
