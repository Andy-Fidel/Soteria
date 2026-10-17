import { describe, expect, it } from "vitest"
import { decayPeakHold } from "./audio-peak-hold"

describe("audio peak hold", () => {
  it("captures a new peak immediately", () => {
    expect(decayPeakHold(-30, -8, 0.01)).toBe(-8)
  })
  it("decays at 30 dB per second without falling below the current peak", () => {
    expect(decayPeakHold(-8, -40, 0.5)).toBe(-23)
    expect(decayPeakHold(-8, -20, 1)).toBe(-20)
  })
  it("stops at the meter floor and ignores backwards clock intervals", () => {
    expect(decayPeakHold(-50, -80, 1)).toBe(-60)
    expect(decayPeakHold(-8, -20, -1)).toBe(-8)
  })
})
