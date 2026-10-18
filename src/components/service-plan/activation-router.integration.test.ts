import { beforeEach, expect, it, vi } from "vitest"
import { activatePlanItem } from "./activation-router"
import { useBroadcastStore } from "@/stores/broadcast-store"
import type { PlanItem } from "@/types"

const { emitMock, invokeMock } = vi.hoisted(() => ({
  emitMock: vi.fn().mockResolvedValue(undefined),
  invokeMock: vi.fn().mockResolvedValue(undefined),
}))
vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
  convertFileSrc: (s: string) => s,
}))
vi.mock("@tauri-apps/api/event", () => ({ emit: emitMock }))

const empty: PlanItem = {
  id: 1,
  planId: 1,
  planKind: "session",
  orderIndex: 1,
  itemType: "blank",
  itemData: JSON.stringify({ type: "blank", showLogo: false }),
  autoAdvanceSeconds: null,
}

beforeEach(() => {
  useBroadcastStore.setState({
    liveVerse: null,
    liveNotes: null,
    fullscreenImage: null,
    blankLogo: false,
    isLive: false,
  })
  vi.clearAllMocks()
})

it.each(["welcome", "notes", "video"])(
  "clears %s when presenting an empty plan slide and keeps the projector open",
  (previous) => {
    const broadcast = useBroadcastStore.getState()
    if (previous === "welcome")
      broadcast.setFullscreenImage({
        url: "/service-slides/ewc-adenta-welcome.png",
        label: "Welcome",
      })
    if (previous === "notes")
      broadcast.setLiveNotes({
        planItemId: 2,
        title: "Notes",
        bullets: [{ id: 1, markdown: "A point" }],
      })
    if (previous === "video") broadcast.setBlankLogo(true)
    emitMock.mockClear()
    activatePlanItem(empty)
    expect(useBroadcastStore.getState()).toMatchObject({
      liveVerse: null,
      liveNotes: null,
      fullscreenImage: null,
      blankLogo: false,
    })
    for (const output of ["main", "alt"])
      expect(emitMock).toHaveBeenCalledWith(
        `broadcast:verse-update:${output}`,
        expect.objectContaining({
          verse: null,
          notes: null,
          fullscreenImage: null,
          blankLogo: false,
        })
      )
    expect(invokeMock).not.toHaveBeenCalledWith(
      "close_broadcast_window",
      expect.anything()
    )
  }
)

it("clears previous media when a corrupt plan item falls back to an empty slide", () => {
  useBroadcastStore
    .getState()
    .setFullscreenImage({ url: "/welcome.png", label: "Welcome" })
  activatePlanItem({ ...empty, itemData: "{broken" })
  expect(useBroadcastStore.getState().fullscreenImage).toBeNull()
})
