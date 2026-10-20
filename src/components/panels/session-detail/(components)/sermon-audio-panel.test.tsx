// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
const native = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock("@tauri-apps/api/core", () => ({ invoke: native.invoke }))
vi.mock("@/stores/settings-store", () => ({
  useSettingsStore: { getState: () => ({ deepseekApiKey: "test-key" }) },
}))
import { SermonAudioPanel } from "./sermon-audio-panel"
it("loads audio only on request and requires review before preparing, never auto-publishes", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  URL.createObjectURL = vi.fn(() => "blob:test-audio")
  URL.revokeObjectURL = vi.fn()
  native.invoke.mockImplementation(
    async (command: string, args: Record<string, unknown>) => {
      if (command === "get_sermon_audio")
        return { durationSeconds: 80, prepared: null }
      if (
        command === "read_session_audio" ||
        command === "read_prepared_sermon_audio"
      )
        return new ArrayBuffer(0)
      if (command === "prepare_sermon_audio")
        return {
          revision: "a".repeat(32),
          startSeconds: args.startSeconds,
          endSeconds: args.endSeconds,
          durationSeconds: 80,
          bytes: 500000,
        }
      throw new Error(`Unexpected command: ${command}`)
    }
  )
  const onChange = vi.fn(),
    container = document.createElement("div"),
    root = createRoot(container)
  try {
    await act(async () =>
      root.render(
        <SermonAudioPanel
          sessionId={12}
          startedAtMs={1000}
          disabled={false}
          onChange={onChange}
        />
      )
    )
    expect(native.invoke).not.toHaveBeenCalled()
    await act(async () => container.querySelector("button")!.click())
    const prepare = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Prepare MP3"
    )!
    expect(prepare.disabled).toBe(true)
    await act(async () =>
      container
        .querySelector<HTMLInputElement>('input[type="checkbox"]')!
        .click()
    )
    expect(prepare.disabled).toBe(false)
    await act(async () => prepare.click())
    expect(native.invoke).toHaveBeenCalledWith("prepare_sermon_audio", {
      sessionId: 12,
      startSeconds: 0,
      endSeconds: 80,
      reviewed: true,
    })
    expect(onChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ mode: "included" })
    )
    const checks = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]'
    )
    await act(async () => checks[checks.length - 1].click())
    expect(onChange).toHaveBeenLastCalledWith({
      mode: "included",
      revision: "a".repeat(32),
    })
    expect(native.invoke).not.toHaveBeenCalledWith(
      "publish_session_recap",
      expect.anything()
    )
  } finally {
    await act(async () => root.unmount())
  }
})
