import { expect, it } from "vitest"
import { parsePlanItem } from "@/types"
import type { PlanItem } from "@/types"
const item: PlanItem = {
  id: 1,
  planId: 1,
  planKind: "session",
  itemType: "blank",
  itemData: "",
  orderIndex: 1,
  autoAdvanceSeconds: null,
}
it("restores editable slide words independently of the image", () => {
  const payload = {
    showLogo: false,
    imageUrl: "/starburst.png",
    imageLabel: "Service title",
    textOverlay: {
      layout: "title",
      title: "Sunday Service",
      body: "Pastor Example",
    },
  }
  expect(parsePlanItem({ ...item, itemData: JSON.stringify(payload) })).toEqual(
    { type: "blank", ...payload }
  )
})
it("drops malformed text overlays without damaging an existing image slide", () => {
  const parsed = parsePlanItem({
    ...item,
    itemData: JSON.stringify({
      showLogo: false,
      imageUrl: "/starburst.png",
      textOverlay: { layout: "unknown", title: 12, body: [] },
    }),
  })
  expect(parsed).toEqual({
    type: "blank",
    showLogo: false,
    imageUrl: "/starburst.png",
    imageLabel: undefined,
  })
})
