import { expect, it } from "vitest"
import { smsMetrics, parseSharingDraft } from "./sharing-drafts"

it("counts basic SMS, extended GSM characters, and multipart overhead", () => {
  expect(smsMetrics("a".repeat(160))).toMatchObject({
    encoding: "GSM-7",
    units: 160,
    segments: 1,
    remaining: 0,
  })
  expect(smsMetrics("a".repeat(161)).segments).toBe(2)
  expect(smsMetrics("^".repeat(80))).toMatchObject({ units: 160, segments: 1 })
  expect(smsMetrics("a".repeat(306)).segments).toBe(2)
  expect(smsMetrics("").segments).toBe(0)
})
it("uses the Unicode limit for smart punctuation and counts emoji as two units", () => {
  expect(smsMetrics("God’s love")).toMatchObject({
    encoding: "Unicode",
    limit: 70,
  })
  expect(smsMetrics("🙂".repeat(36))).toMatchObject({ units: 72, segments: 2 })
})
it("keeps generated drafts as plain editable text and rejects incomplete output", () => {
  expect(
    parseSharingDraft(
      '{"title":"Faith","recap":"Keep trusting God.","sms":"Walk by faith."}'
    )
  ).toEqual({
    title: "Faith",
    recap: "Keep trusting God.",
    sms: "Walk by faith.",
  })
  expect(() => parseSharingDraft('{"title":"Faith","sms":"Hello"}')).toThrow()
  expect(() =>
    parseSharingDraft('{"title":"Faith","recap":7,"sms":"Hello"}')
  ).toThrow()
})
