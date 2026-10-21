import { expect, it } from "vitest"
import { canSubmitListSms, needsListSmsProgress } from "./list-sms"

it("allows review or recovery but never resubmits an accepted list send", () => {
  expect(canSubmitListSms({ status: "PREVIEWED", providerId: null })).toBe(true)
  expect(canSubmitListSms({ status: "UNKNOWN", providerId: null })).toBe(true)
  expect(canSubmitListSms({ status: "QUEUED", providerId: "send-1" })).toBe(
    false
  )
  expect(canSubmitListSms({ status: "COMPLETED", providerId: "send-1" })).toBe(
    false
  )
})
it("keeps checking receipts after processing completes", () => {
  expect(
    needsListSmsProgress({
      providerId: "send-1",
      status: "COMPLETED",
      recipientCount: 1,
      delivered: 0,
      totalFailed: 0,
    })
  ).toBe(true)
  expect(
    needsListSmsProgress({
      providerId: "send-1",
      status: "COMPLETED",
      recipientCount: 1,
      delivered: 1,
      totalFailed: 0,
    })
  ).toBe(false)
  expect(
    needsListSmsProgress({
      providerId: null,
      status: "PREVIEWED",
      recipientCount: 1,
      delivered: null,
      totalFailed: 0,
    })
  ).toBe(false)
})
