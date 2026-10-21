import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

if (process.platform !== "darwin" || process.arch !== "arm64") {
  throw new Error("Build the internal Mac draft on Apple Silicon.")
}
const root = resolve(import.meta.dirname, "..")
const source = resolve(process.argv[2] ?? root)
execFileSync("python3", ["scripts/prepare-standard-package.py", "--source", source, "--with-whisper-mac"], { cwd: root, stdio: "inherit" })
const standard = JSON.parse(readFileSync(resolve(root, "src-tauri/tauri.conf.standard.json"), "utf8"))
const speech = JSON.parse(readFileSync(resolve(root, "src-tauri/tauri.conf.signed.json"), "utf8"))
const internal = JSON.parse(readFileSync(resolve(root, "src-tauri/tauri.conf.internal.json"), "utf8"))
const config = {
  ...standard, ...internal,
  bundle: { ...standard.bundle, ...internal.bundle,
    resources: { ...standard.bundle.resources, ...speech.bundle.resources } },
}
const environment = { ...process.env, MANNA_FLAVOR: "standard" }
for (const key of Object.keys(environment)) {
  if (key.startsWith("APPLE_") || key.startsWith("TAURI_SIGNING_PRIVATE_KEY")) delete environment[key]
}
execFileSync("bun", ["run", "tauri", "build", "--ci", "--bundles", "app,dmg", "--target", "aarch64-apple-darwin",
  "--config", JSON.stringify(config), "--features", "onnx,whisper,package-check", "--", "--no-default-features", "--locked"], {
  cwd: root, env: environment, stdio: "inherit",
})
