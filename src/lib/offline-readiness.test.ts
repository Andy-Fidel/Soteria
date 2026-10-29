import { beforeEach, expect, it, vi } from "vitest"
const invoke = vi.hoisted(() => vi.fn())
vi.mock("@tauri-apps/api/core", () => ({ invoke }))
import {
  checkOfflineReadiness,
  describeLocalResources,
  type LocalResourceStatus,
} from "./offline-readiness"

const ready: LocalResourceStatus = {
  translations: ["KJV", "NIV", "NLT"],
  quotationReady: true,
  semanticReady: true,
  sessionStorageReady: true,
}
beforeEach(() => {
  invoke.mockReset()
})
it("requires installed Bible text even if detection engines exist", () => {
  expect(describeLocalResources({ ...ready, translations: [] })).toContainEqual(
    expect.objectContaining({ id: "bible", status: "fail" })
  )
})
it("keeps direct/manual scripture use available when optional indexes are missing", () => {
  const checks = describeLocalResources({
    ...ready,
    quotationReady: false,
    semanticReady: false,
  })
  expect(checks.filter((check) => check.status === "fail")).toEqual([])
  expect(
    checks
      .filter((check) => check.status === "warning")
      .map((check) => check.id)
  ).toEqual(["quotation", "semantic"])
})
it("checks local engines and speech without requesting a cloud connection or key", async () => {
  invoke.mockImplementation(async (command) => {
    if (command === "get_local_resource_status") return ready
    if (command === "prepare_local_speech") return "Small English is ready"
    throw new Error(`Unexpected command: ${command}`)
  })
  expect(
    (await checkOfflineReadiness()).every((check) => check.status === "pass")
  ).toBe(true)
  expect(invoke.mock.calls.map(([command]) => command).sort()).toEqual([
    "get_local_resource_status",
    "prepare_local_speech",
  ])
})
it("fails closed if a corrupt speech model cannot load", async () => {
  invoke.mockImplementation(async (command) => {
    if (command === "get_local_resource_status") return ready
    throw new Error("Invalid speech model")
  })
  expect(await checkOfflineReadiness()).toContainEqual(
    expect.objectContaining({ id: "speech", status: "fail" })
  )
})
it("reports a failed native resource boundary instead of claiming offline readiness", async () => {
  invoke.mockRejectedValue(new Error("Native backend unavailable"))
  const checks = await checkOfflineReadiness()
  expect(checks.every((check) => check.status === "fail")).toBe(true)
})
it("requires a local session database for service capture", () => {
  expect(
    describeLocalResources({ ...ready, sessionStorageReady: false })
  ).toContainEqual(expect.objectContaining({ id: "storage", status: "fail" }))
})
