import { beforeEach, describe, expect, it, vi } from "vitest"
import { listen } from "@tauri-apps/api/event"
import { createTauriListenerScope } from "./tauri-listener-scope"

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }))
const mockListen = vi.mocked(listen)
beforeEach(() => vi.resetAllMocks())

describe("Tauri listener ownership", () => {
  it("registers events and releases every listener once", async () => {
    const unlisten = vi.fn()
    const handler = vi.fn()
    mockListen.mockResolvedValueOnce(unlisten)
    const scope = createTauriListenerScope()
    await scope.register("remote:next", handler)
    mockListen.mock.calls[0][1]({ event: "remote:next", id: 1, payload: null })
    expect(handler).toHaveBeenCalledOnce()
    scope.dispose()
    scope.dispose()
    expect(unlisten).toHaveBeenCalledOnce()
    mockListen.mock.calls[0][1]({ event: "remote:next", id: 1, payload: null })
    expect(handler).toHaveBeenCalledOnce()
  })
  it("releases a listener that resolves after cleanup and skips later registrations", async () => {
    let finish!: (unlisten: () => void) => void
    mockListen.mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
    const scope = createTauriListenerScope()
    const registration = scope.register("remote:next", vi.fn())
    scope.dispose()
    const unlisten = vi.fn()
    finish(unlisten)
    await registration
    await scope.register("remote:prev", vi.fn())
    expect(unlisten).toHaveBeenCalledOnce()
    expect(mockListen).toHaveBeenCalledOnce()
  })
  it("releases earlier listeners when a later registration rejects", async () => {
    const unlisten = vi.fn()
    mockListen.mockResolvedValueOnce(unlisten).mockRejectedValueOnce(new Error("closed window"))
    const scope = createTauriListenerScope()
    await scope.register("remote:next", vi.fn())
    await expect(scope.register("remote:prev", vi.fn())).rejects.toThrow("closed window")
    expect(unlisten).toHaveBeenCalledOnce()
    await scope.register("remote:theme", vi.fn())
    expect(mockListen).toHaveBeenCalledTimes(2)
  })
})
