import { beforeEach, describe, expect, it, vi } from "vitest"
import { listen } from "@tauri-apps/api/event"
import { subscribeRemoteCommands } from "./remote-command-listener"

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }))

const mockedListen = vi.mocked(listen)

describe("settings remote command listeners", () => {
  beforeEach(() => vi.resetAllMocks())

  it("logs received commands and removes all registered listeners", async () => {
    const unlisteners = Array.from({ length: 7 }, () => vi.fn())
    for (const unlisten of unlisteners)
      mockedListen.mockResolvedValueOnce(unlisten)
    const onCommand = vi.fn()
    const cleanup = subscribeRemoteCommands(onCommand)
    await vi.waitFor(() => expect(mockedListen).toHaveBeenCalledTimes(7))
    const handler = mockedListen.mock.calls[0][1]
    handler({ event: "remote:next", id: 1, payload: undefined })
    expect(onCommand).toHaveBeenCalledWith("next")
    cleanup()
    for (const unlisten of unlisteners) expect(unlisten).toHaveBeenCalledOnce()
    handler({ event: "remote:next", id: 1, payload: undefined })
    expect(onCommand).toHaveBeenCalledOnce()
  })

  it("removes a pending registration after the settings tab closes", async () => {
    let finishRegistration!: (unlisten: () => void) => void
    mockedListen.mockReturnValueOnce(
      new Promise((resolve) => {
        finishRegistration = resolve
      })
    )
    const onCommand = vi.fn()
    const cleanup = subscribeRemoteCommands(onCommand)
    cleanup()
    const unlisten = vi.fn()
    finishRegistration(unlisten)
    await vi.waitFor(() => expect(unlisten).toHaveBeenCalledOnce())
    expect(mockedListen).toHaveBeenCalledOnce()
    mockedListen.mock.calls[0][1]({
      event: "remote:next",
      id: 1,
      payload: undefined,
    })
    expect(onCommand).not.toHaveBeenCalled()
  })
})
