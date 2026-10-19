import { expect, it } from "vitest"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import { decodeThemeBackup } from "./theme-transfer"
it("validates backup versions and creates copies without overwriting built-ins", () => {
  expect(() => decodeThemeBackup('{"version":99,"themes":[]}')).toThrow()
  expect(() => decodeThemeBackup('{"version":1,"themes":[{}]}')).toThrow()
  const [theme] = decodeThemeBackup(
    JSON.stringify({ version: 1, themes: [BUILTIN_THEMES[0]] })
  )
  expect(theme.builtin).toBe(false)
  expect(theme.id).not.toBe(BUILTIN_THEMES[0].id)
  expect(theme.verseText).toEqual(BUILTIN_THEMES[0].verseText)
})
