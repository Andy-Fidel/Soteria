import { expect, it } from "vitest"
import { parseSmsAlternatives } from "./sms-alternatives"
const options = [
  { approach: "action", message: "Set aside a distraction this week." },
  { approach: "encouragement", message: "Your obedience matters to God." },
  { approach: "reflection", message: "What holds back your obedience?" },
]
it("orders the three approaches and preserves exact messages", () => {
  expect(
    parseSmsAlternatives(options).map((option) => option.approach)
  ).toEqual(["encouragement", "reflection", "action"])
})
it("rejects missing, repeated, and multipart options", () => {
  expect(() => parseSmsAlternatives([])).toThrow()
  expect(() =>
    parseSmsAlternatives(
      options.map((option) => ({ ...option, message: "Same." }))
    )
  ).toThrow()
  expect(() =>
    parseSmsAlternatives(
      options.map((option) => ({ ...option, message: "x".repeat(161) }))
    )
  ).toThrow()
})
