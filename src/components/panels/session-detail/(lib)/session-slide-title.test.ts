import { expect, it } from "vitest"
import { sessionSlideTitle } from "./session-slide-title"
const date = "Monday, Oct 19, 2026 — 8:30 PM"
it("uses a sermon title instead of a default date for new and older sessions", () => {
  for (const titleSource of ["default", "manual", undefined] as const) {
    expect(
      sessionSlideTitle(
        { title: date, titleSource },
        date,
        date,
        "Pleasing the King"
      )
    ).toBe("Pleasing the King")
  }
})
it("keeps explicit names and announced titles protected", () => {
  for (const titleSource of ["manual", "announced"] as const) {
    expect(
      sessionSlideTitle(
        { title: "Walk by faith", titleSource },
        date,
        "Other title",
        "Another title"
      )
    ).toBe("Walk by faith")
  }
})
it("uses an edited recap title and falls back safely when no sermon title exists", () => {
  expect(
    sessionSlideTitle(
      { title: date, titleSource: "default" },
      date,
      "Pleasing the King",
      "Obedience"
    )
  ).toBe("Pleasing the King")
  expect(
    sessionSlideTitle({ title: date, titleSource: "default" }, date, "", "")
  ).toBe(date)
})
