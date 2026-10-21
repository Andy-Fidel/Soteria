import { expect, it } from "vitest"
import { parseColorOpacity, buildColorWithOpacity } from "./color-value"
it("preserves rgba and short-hex colors when edited", () => {
  expect(parseColorOpacity("rgba(20,40,60,0.6)")).toEqual({
    hex: "#14283c",
    opacity: 60,
  })
  expect(parseColorOpacity("#fff8")).toEqual({ hex: "#ffffff", opacity: 53 })
  expect(buildColorWithOpacity("#ffffff", 0)).toBe("#ffffff00")
})
