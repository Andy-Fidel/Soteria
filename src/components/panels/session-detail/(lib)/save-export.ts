import { save } from "@tauri-apps/plugin-dialog"
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs"
export async function saveTextExport(
  content: string,
  defaultPath: string,
  filter: { name: string; extensions: string[] }
) {
  const filePath = await save({
    defaultPath,
    filters: [filter],
  })
  if (!filePath) return false
  await writeTextFile(filePath, content)
  return true
}

export async function saveBinaryExport(
  content: Uint8Array,
  defaultPath: string,
  filter: { name: string; extensions: string[] }
) {
  const filePath = await save({
    defaultPath,
    filters: [filter],
  })
  if (!filePath) return false
  await writeFile(filePath, content)
  return true
}
