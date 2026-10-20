import { expect, it, vi } from "vitest"
const invoke = vi.hoisted(() => vi.fn())
vi.mock("@tauri-apps/api/core", () => ({ invoke }))
import { prepareSpeechReadiness } from "./speech-readiness"

it("blocks local speech when its model cannot load", async () => {
  invoke.mockRejectedValueOnce("The offline speech model is missing")
  expect(await prepareSpeechReadiness("whisper", null)).toMatchObject({ status: "fail", detail: "The offline speech model is missing" })
})
it("reports local readiness only after the native model loads", async () => {
  invoke.mockResolvedValueOnce("Small English is ready")
  expect(await prepareSpeechReadiness("whisper", null)).toMatchObject({ status: "pass" })
})
