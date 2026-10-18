import { expect, it, vi } from "vitest"
import type { PlanItem, PlanItemPayload } from "@/types"
import { getPlanItemThumbnail } from "./plan-item-thumbnail"
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
  invoke: vi.fn(),
}))
const brand = { momoImagePath: null, jesusImagePath: null }
function item(payload: PlanItemPayload): PlanItem {
  return {
    id: 1,
    planId: 7,
    planKind: "session",
    itemType: payload.type,
    itemData: JSON.stringify(payload),
    orderIndex: 1,
    autoAdvanceSeconds: null,
  }
}
it("uses saved title text and its actual background", () => {
  const textOverlay = {
    layout: "title" as const,
    title: "Living by Faith",
    body: "Pastor John Kennedy",
  }
  expect(
    getPlanItemThumbnail(
      item({
        type: "blank",
        showLogo: false,
        imageUrl: "/starburst.png",
        imageLabel: "Service title",
        textOverlay,
      }),
      brand
    )
  ).toEqual({ url: "/starburst.png", label: "Service title", textOverlay })
})
it("keeps image-only slides tied to the saved image", () => {
  expect(
    getPlanItemThumbnail(
      item({
        type: "blank",
        showLogo: false,
        imageUrl: "/welcome.png",
        imageLabel: "Welcome",
      }),
      brand
    )
  ).toEqual({ url: "/welcome.png", label: "Welcome" })
})
it("respects custom payment and Jesus artwork", () => {
  expect(
    getPlanItemThumbnail(item({ type: "momo" }), {
      ...brand,
      momoImagePath: "/custom.png",
    })?.url
  ).toBe("asset:/custom.png")
  expect(getPlanItemThumbnail(item({ type: "jesus" }), brand)?.url).toContain(
    "/service-slides/jesus-motion.png"
  )
})
it("previews the first prayer point on its chosen background", () => {
  const preview = getPlanItemThumbnail(
    item({
      type: "blank",
      showLogo: false,
      prayer: {
        background: "cross-light",
        points: ["Pray for families", "Pray for peace"],
      },
    }),
    brand
  )
  expect(preview?.url).toBe("/service-slides/prayer-cross-light.png")
  expect(preview?.textOverlay?.body).toBe("Pray for families")
})
it("leaves section headers, songs and plain blanks compact", () => {
  for (const payload of [
    { type: "section", label: "Worship" },
    { type: "song", songId: 1, arrangement: [] },
    { type: "blank", showLogo: true },
  ] as PlanItemPayload[])
    expect(getPlanItemThumbnail(item(payload), brand)).toBeNull()
  expect(
    getPlanItemThumbnail(
      { ...item({ type: "momo" }), itemData: "invalid" },
      brand
    )
  ).toBeNull()
})
