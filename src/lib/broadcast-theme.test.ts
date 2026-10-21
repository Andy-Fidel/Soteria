import { expect, it } from "vitest"
import { BUILTIN_THEMES } from "./builtin-themes"
import { parseBroadcastTheme, themeHasChanges } from "./broadcast-theme"
it("keeps stable defaults while rejecting damaged themes", () => {
  for (const theme of BUILTIN_THEMES)
    expect(parseBroadcastTheme(theme).verseText).toEqual(theme.verseText)
  for (const value of [
    {},
    null,
    { ...BUILTIN_THEMES[0], resolution: { width: 0, height: 1080 } },
    {
      ...BUILTIN_THEMES[0],
      background: { ...BUILTIN_THEMES[0].background, color: "#GGGGGG" },
    },
  ])
    expect(() => parseBroadcastTheme(value)).toThrow()
})
it("compares content independently of timestamps and object key order", () => {
  const theme = BUILTIN_THEMES[0]
  expect(
    themeHasChanges(
      {
        ...theme,
        updatedAt: Date.now(),
        layout: {
          ...theme.layout,
          padding: { left: 60, right: 60, bottom: 40, top: 40 },
        },
      },
      theme
    )
  ).toBe(false)
  expect(themeHasChanges({ ...theme, name: "Changed" }, theme)).toBe(true)
})

it("preserves older themes' attached references, alignment fallbacks, and absent logos", () => {
  const legacy = structuredClone(BUILTIN_THEMES[1])
  delete legacy.reference.standalone
  delete legacy.reference.horizontalAlign
  delete legacy.reference.textTransform
  delete legacy.verseText.horizontalAlign
  delete legacy.verseText.autoFit
  delete legacy.layout.referenceGap
  delete legacy.logo
  const parsed = parseBroadcastTheme(legacy)
  expect(parsed.reference.standalone).toBeNull()
  expect(parsed.reference.horizontalAlign).toBeUndefined()
  expect(parsed.reference.textTransform).toBeUndefined()
  expect(parsed.verseText.horizontalAlign).toBeUndefined()
  expect(parsed.verseText.autoFit).toBe(false)
  expect(parsed.layout.referenceGap).toBeUndefined()
  expect(parsed.logo).toBeNull()
})
