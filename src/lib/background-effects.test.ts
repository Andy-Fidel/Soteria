import { expect, it } from "vitest"
import { filterBackgroundPixels } from "./background-effects"
it("applies brightness when canvas filters are unavailable", () => {
  const pixels = new Uint8ClampedArray([200, 100, 50, 255])
  filterBackgroundPixels(pixels, 1, 1, 50, 0)
  expect([...pixels]).toEqual([100, 50, 25, 255])
})
it("blurs an edge without changing a solid image", () => {
  const solid = new Uint8ClampedArray([
    80, 90, 100, 255, 80, 90, 100, 255, 80, 90, 100, 255,
  ])
  filterBackgroundPixels(solid, 3, 1, 100, 1)
  expect([...solid]).toEqual([
    80, 90, 100, 255, 80, 90, 100, 255, 80, 90, 100, 255,
  ])
  const edge = new Uint8ClampedArray([
    0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  ])
  filterBackgroundPixels(edge, 3, 1, 100, 1)
  expect(edge[0]).toBeGreaterThan(0)
  expect(edge[0]).toBeLessThan(edge[8])
})
