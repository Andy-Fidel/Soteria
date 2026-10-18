import { expect, it } from "vitest"
import type { PlanItem, PlanItemBlank, SermonSession } from "@/types"
import { resolveImageSlideTitle } from "./image-text-slide-title"

const item: PlanItem = {
  id: 1,
  planId: 7,
  planKind: "session",
  itemType: "blank",
  itemData: "{}",
  orderIndex: 0,
  autoAdvanceSeconds: null,
}
const parsed: PlanItemBlank = {
  type: "blank",
  showLogo: false,
  textOverlay: { layout: "title", title: "", body: "Pastor John Kennedy" },
}
const session: SermonSession = {
  id: 7,
  title: "Faith in the Waiting",
  titleSource: "announced",
  speaker: null,
  date: "2026-10-18",
  seriesName: null,
  tags: [],
  startedAt: null,
  endedAt: null,
  status: "live",
  plannedScriptures: [],
  summary: null,
  audioPath: null,
  createdAt: "",
  updatedAt: "",
}

it("fills an empty slide with the exact AI-verified announced title", () => {
  expect(resolveImageSlideTitle(item, parsed, session, null)).toBe(
    session.title
  )
})
it("responds when a title is confirmed after the editor opens", () => {
  expect(
    resolveImageSlideTitle(
      item,
      parsed,
      { ...session, titleSource: "default" },
      null
    )
  ).toBe("")
  expect(resolveImageSlideTitle(item, parsed, session, null)).toBe(
    session.title
  )
})
it.each(["My wording", ""])(
  "protects user edits including a deliberately cleared field: %j",
  (edited) => {
    expect(resolveImageSlideTitle(item, parsed, session, edited)).toBe(edited)
  }
)
it("keeps saved slide titles", () => {
  expect(
    resolveImageSlideTitle(
      item,
      {
        ...parsed,
        textOverlay: { ...parsed.textOverlay!, title: "Saved title" },
      },
      session,
      null
    )
  ).toBe("Saved title")
})
it.each(["default", "manual"] as const)(
  "does not substitute a %s session name",
  (titleSource) => {
    expect(
      resolveImageSlideTitle(item, parsed, { ...session, titleSource }, null)
    ).toBe("")
  }
)
it("never takes titles from another session or inserts them in announcements or templates", () => {
  expect(
    resolveImageSlideTitle(item, parsed, { ...session, id: 8 }, null)
  ).toBe("")
  expect(resolveImageSlideTitle(item, parsed, null, null)).toBe("")
  expect(
    resolveImageSlideTitle(
      item,
      {
        ...parsed,
        textOverlay: { ...parsed.textOverlay!, layout: "announcement" },
      },
      session,
      null
    )
  ).toBe("")
  expect(
    resolveImageSlideTitle(
      { ...item, planKind: "template" },
      parsed,
      session,
      null
    )
  ).toBe("")
})
