// @vitest-environment jsdom
import { act, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { useSermonAudioEditor } from "./use-sermon-audio-editor"
const native = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }))
vi.mock("@/stores/settings-store", () => ({
  useSettingsStore: { getState: () => ({ deepseekApiKey: "test-key" }) },
}))
let current: ReturnType<typeof useSermonAudioEditor>
let root: Root
const onChange = vi.fn()
function Harness() {
  const editor = useSermonAudioEditor({
    sessionId: 12,
    startedAtMs: 1000,
    disabled: false,
    onChange,
  })
  useEffect(() => {
    current = editor
  })
  return null
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  onChange.mockClear()
  native.invoke
    .mockReset()
    .mockResolvedValue({ durationSeconds: 100.123, prepared: null })
  root = createRoot(document.createElement("div"))
  await act(async () => root.render(<Harness />))
})
afterEach(async () => {
  await act(async () => root.unmount())
})
it("never prepares an unreviewed selection or uploads anything on load", async () => {
  await act(async () => {
    await current.actions.prepare()
  })
  expect(native.invoke).toHaveBeenCalledExactlyOnceWith("get_sermon_audio", {
    sessionId: 12,
  })
  expect(current.state.cut.reviewed).toBe(false)
})
it("applies suggested cuts without approving or exporting them", async () => {
  native.invoke.mockResolvedValueOnce({
    startSeconds: 10.5,
    endSeconds: 90.25,
    reason: "Teaching starts after worship.",
  })
  await act(async () => {
    await current.actions.suggest()
  })
  expect(current.state.cut).toMatchObject({
    start: "00:10.5",
    end: "01:30.25",
    reviewed: false,
  })
  expect(onChange).toHaveBeenLastCalledWith({ mode: "excluded" })
  expect(native.invoke).toHaveBeenCalledTimes(2)
})
it("prepares only reviewed cuts and invalidates inclusion when the selection changes", async () => {
  await act(async () =>
    current.actions.setCut((cut) => ({
      ...cut,
      start: "00:10",
      end: "01:30",
      reviewed: true,
    }))
  )
  native.invoke.mockResolvedValueOnce({
    revision: "a".repeat(32),
    startSeconds: 10,
    endSeconds: 90,
    durationSeconds: 80.1,
    bytes: 500000,
  })
  await act(async () => {
    await current.actions.prepare()
  })
  expect(native.invoke).toHaveBeenLastCalledWith("prepare_sermon_audio", {
    sessionId: 12,
    startSeconds: 10,
    endSeconds: 90,
    reviewed: true,
  })
  expect(current.state.preparedMatches).toBe(true)
  expect(current.state.included).toBe(false)
  await act(async () => current.actions.change("start", "00:10.5"))
  expect(current.state.preparedMatches).toBe(false)
  expect(current.state.cut.reviewed).toBe(false)
  expect(onChange).toHaveBeenLastCalledWith({ mode: "excluded" })
})
it("retains the existing selection after a suggestion fails", async () => {
  await act(async () => current.actions.change("start", "00:12"))
  native.invoke.mockRejectedValueOnce(new Error("Unclear sermon boundaries"))
  await act(async () => {
    await current.actions.suggest()
  })
  expect(current.state.cut.start).toBe("00:12")
  expect(current.state.error).toContain("Unclear sermon boundaries")
})
