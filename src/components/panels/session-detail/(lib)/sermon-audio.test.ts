import { expect, it } from "vitest"
import { parseAudioTime, validAudioCut } from "./sermon-audio"
it("parses seconds, minutes and hours for manual cut points", () => {
  expect(parseAudioTime("90")).toBe(90)
  expect(parseAudioTime("02:30")).toBe(150)
  expect(parseAudioTime("1:02:03")).toBe(3723)
  expect(parseAudioTime("00:10.5")).toBe(10.5)
  for (const text of ["", "-1", "1:60", "a:b", "1::2", "1:2:3:4"])
    expect(parseAudioTime(text)).toBeNull()
})
it("requires ordered cut points within the source recording", () => {
  expect(validAudioCut(10, 20, 60)).toBe(true)
  for (const [start, end] of [
    [null, 20],
    [20, 10],
    [10, 11],
    [0, 61],
    [-1, 10],
    [NaN, 20],
  ])
    expect(validAudioCut(start, end, 60)).toBe(false)
})
it("preserves fractional cut points without rounding past the recording end", async () => {
  const { formatCutTime } = await import("./sermon-audio")
  const duration = 60.12345
  expect(parseAudioTime(formatCutTime(duration))).toBeLessThanOrEqual(duration)
  expect(parseAudioTime(formatCutTime(duration))).toBeGreaterThan(60)
})
