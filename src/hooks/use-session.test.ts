import { expect, it, vi } from "vitest"
import { useSession } from "./use-session"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))

it("keeps the session-list loader stable across renders so loading does not trigger itself", () => {
  const firstRender = useSession()
  const nextRender = useSession()
  expect(nextRender.listSessions).toBe(firstRender.listSessions)
})
