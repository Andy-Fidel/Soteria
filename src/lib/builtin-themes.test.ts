import { describe, expect, it } from "vitest"
import { BUILTIN_THEMES } from "./builtin-themes"

describe("built-in broadcast themes", () => {
  it("leaves the scripture canvas free of default logos", () => {
    expect(BUILTIN_THEMES.every((theme) => !theme.logo)).toBe(true)
  })

  it("ships only the six approved themes", () => {
    expect(BUILTIN_THEMES.map((theme) => theme.id)).toEqual([
      "builtin-bold-proclamation",
      "builtin-the-word",
      "builtin-quiet-light",
      "builtin-night-sky",
      "builtin-still-waters",
      "builtin-refractions-rush",
    ])
  })
})
