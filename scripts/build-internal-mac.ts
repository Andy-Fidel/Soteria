import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

if (process.platform !== "darwin") throw new Error("Build the Mac installer on macOS.")
const root = resolve(import.meta.dirname, "..")
execFileSync("python3", ["scripts/prepare-standard-package.py"], { cwd: root, stdio: "inherit" })
const standard = JSON.parse(readFileSync(resolve(root, "src-tauri/tauri.conf.standard.json"), "utf8"))
const internal = JSON.parse(readFileSync(resolve(root, "src-tauri/tauri.conf.internal.json"), "utf8"))
const config = {
  ...standard,
  ...internal,
  bundle: { ...standard.bundle, ...internal.bundle },
}
const environment = { ...process.env, MANNA_FLAVOR: "standard" }
// An internal ad-hoc build must not use Developer ID or updater signing secrets.
for (const key of Object.keys(environment)) {
  if (key.startsWith("APPLE_") || key.startsWith("TAURI_SIGNING_PRIVATE_KEY")) delete environment[key]
}
execFileSync("bun", ["run", "tauri", "build", "--ci", "--bundles", "app,dmg", "--config", JSON.stringify(config), "--features", "onnx,package-check", "--", "--no-default-features", "--locked"], {
  cwd: root,
  env: environment,
  stdio: "inherit",
})
