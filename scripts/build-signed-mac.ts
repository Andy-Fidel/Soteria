import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

if (process.platform !== "darwin") throw new Error("Build the Mac installer on macOS.")
const root = resolve(import.meta.dirname, "..")
execFileSync("python3", ["scripts/prepare-standard-package.py", "--with-whisper-mac"], { cwd: root, stdio: "inherit" })
const standard = JSON.parse(readFileSync(resolve(root, "src-tauri/tauri.conf.standard.json"), "utf8"))
const signed = JSON.parse(readFileSync(resolve(root, "src-tauri/tauri.conf.signed.json"), "utf8"))
const config = {
  ...standard,
  bundle: { ...standard.bundle, ...signed.bundle, resources: { ...standard.bundle.resources, ...signed.bundle.resources } },
}
const environment = { ...process.env, MANNA_FLAVOR: "standard" }
// Use explicit Keychain signing/notary steps after the build; never expose keys to it.
for (const key of Object.keys(environment)) {
  if (key.startsWith("APPLE_") || key.startsWith("TAURI_SIGNING_PRIVATE_KEY")) delete environment[key]
}
execFileSync("bun", ["run", "tauri", "build", "--ci", "--no-sign", "--bundles", "app", "--config", JSON.stringify(config), "--features", "onnx,whisper,package-check", "--", "--no-default-features", "--locked"], { cwd: root, env: environment, stdio: "inherit" })
