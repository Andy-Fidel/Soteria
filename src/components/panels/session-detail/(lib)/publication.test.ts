import { expect, it } from "vitest"
import {
  attachSermonLink,
  canonicalSermonLinks,
  formatSermonSms,
} from "./publication"
it("adds one exact link and replaces an older link without discarding the takeaway", () => {
  const url = "https://sermon.ewcadentan.com/s/d89b7ee6b9064643"
  expect(attachSermonLink("Walk by faith.", url)).toBe(
    `Walk by faith.\n\nRead this week's sermon recap:\n${url}`
  )
  expect(
    attachSermonLink(
      `Walk by faith.\n\nRead this week's sermon recap:\n${url}`,
      url
    )
  ).toBe(`Walk by faith.\n\nRead this week's sermon recap:\n${url}`)
  expect(
    attachSermonLink(
      "Walk by faith. https://sermon.ewcadenta.com/s/abcdef0123456789",
      url
    )
  ).toBe(`Walk by faith.\n\nRead this week's sermon recap:\n${url}`)
})
it("uses the Adentan domain for old links without changing IDs or unrelated URLs", () => {
  const id = "d89b7ee6b9064643"
  const old = `https://sermon.ewcadenta.com/s/${id}`
  const current = `https://sermon.ewcadentan.com/s/${id}`
  expect(canonicalSermonLinks(`Read ${old}`)).toBe(`Read ${current}`)
  expect(
    attachSermonLink(
      `Walk by faith.\n\nRead this week's sermon recap:\n${current}`,
      old
    )
  ).toBe(`Walk by faith.\n\nRead this week's sermon recap:\n${current}`)
  expect(
    canonicalSermonLinks("https://sermon.ewcadenta.com.example.org/s/" + id)
  ).toBe("https://sermon.ewcadenta.com.example.org/s/" + id)
})

it("normalizes pasted links and remains stable when formatted repeatedly", () => {
  const url = "https://sermon.ewcadentan.com/s/d89b7ee6b9064643"
  const formatted = `Walk by faith.\n\nRead this week's sermon recap:\n${url}`
  expect(formatSermonSms(`Walk by faith. ${url}`)).toBe(formatted)
  expect(formatSermonSms(`Walk by faith.\n\n\n${url}`)).toBe(formatted)
  expect(formatSermonSms(formatted)).toBe(formatted)
  expect(formatSermonSms("Walk by faith.")).toBe("Walk by faith.")
})

it("does not duplicate the invitation when a linked draft is saved again", () => {
  const url = "https://sermon.ewcadentan.com/s/d89b7ee6b9064643"
  const expected = `Walk by faith.\n\nRead this week's sermon recap:\n${url}`
  expect(attachSermonLink(expected, url)).toBe(expected)
  expect(
    formatSermonSms(`Walk by faith.\nRead this week's recap:\n\n${url}`)
  ).toBe(expected)
})

it("moves the blank line in an older SMS above the invitation", () => {
  const url = "https://sermon.ewcadentan.com/s/8afd07e3dadc4b10"
  expect(
    formatSermonSms(`Walk by faith.\nRead this week's sermon recap:\n\n${url}`)
  ).toBe(`Walk by faith.\n\nRead this week's sermon recap:\n${url}`)
})
