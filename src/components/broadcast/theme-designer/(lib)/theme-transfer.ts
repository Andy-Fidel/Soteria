import type { BroadcastTheme } from "@/types"
import { parseBroadcastTheme } from "@/lib/broadcast-theme"

export function decodeThemeBackup(json: string): BroadcastTheme[] {
  if (json.length > 64 * 1024 * 1024)
    throw new Error("Theme backup is too large.")
  const value = JSON.parse(json)
  if (
    value?.version !== 1 ||
    !Array.isArray(value.themes) ||
    value.themes.length < 1 ||
    value.themes.length > 100
  )
    throw new Error(
      "Choose a Soteria theme backup (version 1, up to 100 themes)."
    )
  return value.themes.map((item: unknown) => {
    const theme = parseBroadcastTheme(item)
    return {
      ...theme,
      id: crypto.randomUUID(),
      builtin: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  })
}

async function embedImage(url: string) {
  if (!url || url.startsWith("data:")) return url
  const response = await fetch(url)
  if (!response.ok)
    throw new Error("Could not include a theme image in the backup.")
  const blob = await response.blob()
  if (blob.size > 8 * 1024 * 1024)
    throw new Error("A theme image is larger than 8 MB.")
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error("Could not read a theme image."))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(blob)
  })
}
export async function exportThemeBackup(themes: BroadcastTheme[]) {
  const images = new Map<string, Promise<string>>()
  const embed = (url: string) => {
    if (!images.has(url)) images.set(url, embedImage(url))
    return images.get(url)!
  }
  const packed = await Promise.all(
    themes.map(async (source) => {
      const theme = structuredClone(source)
      if (theme.background.image?.url)
        theme.background.image.url = await embed(theme.background.image.url)
      if (theme.logo?.url) theme.logo.url = await embed(theme.logo.url)
      return theme
    })
  )
  const { save } = await import("@tauri-apps/plugin-dialog")
  const { writeTextFile } = await import("@tauri-apps/plugin-fs")
  const output = JSON.stringify({ version: 1, themes: packed }, null, 2)
  if (output.length > 64 * 1024 * 1024)
    throw new Error("Export fewer themes at once; this backup exceeds 64 MB.")
  const path = await save({
    defaultPath: "soteria-themes.json",
    filters: [{ name: "Soteria themes", extensions: ["json"] }],
  })
  if (!path) return false
  await writeTextFile(path, output)
  return true
}
