import { expect, it } from "vitest"
import { opaqueTextColor } from "./opaque-text-color"

it.each([
  ["#ffffff80", "#ffffff"],
  ["#12345600", "#123456"],
  ["#abc8", "#aabbcc"],
  ["rgba(12, 34, 56, 0.5)", "rgb(12, 34, 56)"],
  ["rgb(12 34 56 / 50%)", "rgb(12 34 56)"],
  ["hsla(120, 40%, 50%, 0.5)", "hsl(120, 40%, 50%)"],
  ["hsl(120 40% 50% / .5)", "hsl(120 40% 50%)"],
  ["color(srgb 1 0 0 / 0.5)", "color(srgb 1 0 0)"],
  ["oklch(50% 0.1 120 / .5)", "oklch(50% 0.1 120)"],
  ["#aab3c2", "#aab3c2"],
  ["white", "white"],
  ["transparent", "#000000"],
])("makes %s opaque without changing its color channels", (input, expected) => {
  expect(opaqueTextColor(input)).toBe(expected)
})
