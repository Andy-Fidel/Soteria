import { describe, expect, it } from "vitest"
import { parseTestNumbers, canSendBatch } from "./sms-send"

describe("test SMS recipients", () => {
  it("normalizes Ghana formats and removes duplicate recipients", () => {
    expect(parseTestNumbers("0501234567\n+233501234567, 233241234567")).toEqual(
      {
        numbers: ["233501234567", "233241234567"],
        invalid: [],
        duplicates: 1,
      }
    )
  })
  it("flags invalid recipients instead of sending a partial list", () => {
    expect(parseTestNumbers("123; 0501234567").invalid).toEqual(["123"])
  })
  it("never enables sending an already accepted batch", () => {
    expect(canSendBatch([{ status: "QUEUED" }, { status: "DELIVERED" }])).toBe(
      false
    )
    expect(canSendBatch([{ status: "UNKNOWN" }])).toBe(true)
    expect(canSendBatch([])).toBe(false)
  })
})
