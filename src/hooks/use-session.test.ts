import { expect, it, vi } from "vitest"
import { useSession } from "./use-session"

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }))

it("keeps the session-list loader stable across renders so loading does not trigger itself", () => {
  const firstRender = useSession()
  const nextRender = useSession()
  expect(nextRender.listSessions).toBe(firstRender.listSessions)
})

it("updates the live name and protects it after a manual rename", async () => {
  const { invoke } = await import("@tauri-apps/api/core")
  const { useSessionStore } = await import("@/stores/session-store")
  const session = { id: 8, title: "Automatic", titleSource: "default", status: "live" } as import("@/types/session").SermonSession
  useSessionStore.setState({ activeSession: session, sessions: [session], sessionsView: { id: 8, title: "Automatic" } })
  vi.mocked(invoke).mockResolvedValue(undefined)
  await useSession().renameSession(8, "My manual title")
  expect(useSessionStore.getState().activeSession).toMatchObject({ title: "My manual title", titleSource: "manual" })
  expect(useSessionStore.getState().sessionsView?.title).toBe("My manual title")
})
