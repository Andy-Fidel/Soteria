import { expect, test } from "vitest"
import { spawn } from "node:child_process"
import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, sep } from "node:path"

async function runDownload(platform: string, fail: boolean) {
  const root = await mkdtemp(join(tmpdir(), "manna-ndi-sdk-"))
  try {
    await mkdir(join(root, "data"))
    const script = join(root, "data", "download-ndi-sdk.ts")
    await copyFile(new URL("./download-ndi-sdk.ts", import.meta.url), script)
    const preload = join(root, "fetch-fixture.ts")
    // Keep network out of this CLI test. The real script still selects files,
    // writes them to disk and decides the process exit status.
    await writeFile(preload, `globalThis.fetch = async () => new Response("runtime fixture", {status: ${fail ? 503 : 200}});`)
    const child = spawn("bun", ["--preload", preload, script, "--platform", platform], {
      stdio: ["ignore", "pipe", "pipe"],
    })
    child.stdout.resume()
    child.stderr.resume()
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.on("error", reject)
      child.on("close", resolve)
    })
    const files = await readdir(join(root, "sdk", "ndi"), { recursive: true }).catch(() => [])
    return { exitCode, files: files.map((file) => file.split(sep).join("/")) }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test("Windows release download writes only the Windows runtime", async () => {
  const result = await runDownload("windows", false)
  expect(result.exitCode).toBe(0)
  expect(result.files.filter((file) => /\.(dll|dylib|so|h)$/.test(file))).toEqual([
    "windows/Processing.NDI.Lib.x64.dll",
  ])
})

test("failed runtime download fails the release command", async () => {
  expect((await runDownload("windows", true)).exitCode).toBe(1)
})

test("unknown platform fails before writing runtime files", async () => {
  const result = await runDownload("windwos", false)
  expect(result.exitCode).toBe(1)
  expect(result.files).toEqual([])
})
