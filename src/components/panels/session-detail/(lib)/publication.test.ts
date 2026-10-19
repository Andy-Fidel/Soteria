import { expect, it } from "vitest"
import { attachSermonLink } from "./publication"
it("adds one exact link and replaces an older link without discarding the takeaway", () => {
  const url = "https://sermon.ewcadenta.com/s/d89b7ee6b9064643"
  expect(attachSermonLink("Walk by faith.", url)).toBe(`Walk by faith. ${url}`)
  expect(attachSermonLink(`Walk by faith. ${url}`, url)).toBe(
    `Walk by faith. ${url}`
  )
  expect(
    attachSermonLink(
      "Walk by faith. https://sermon.ewcadenta.com/s/abcdef0123456789",
      url
    )
  ).toBe(`Walk by faith. ${url}`)
})
