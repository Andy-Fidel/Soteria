/** Build a local candidate that includes every core offline resource. */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const stageName = (platform) => platform === "win32" ? "windows-standard" : "standard"

export function offlineConfig(platform) {
  if (platform !== "darwin" && platform !== "win32") {
    throw new Error("Offline installer builds currently support macOS and Windows. Linux packaging needs separate validation.")
  }
  const read = (name) => JSON.parse(readFileSync(resolve(root, "src-tauri", name), "utf8"))
  const standard = read("tauri.conf.standard.json")
  const speech = read(platform === "darwin" ? "tauri.conf.signed.json" : "tauri.conf.windows-standard.json")
  const internal = read("tauri.conf.internal.json")
  // Both the detection manifest and speech files must come from the same verified stage.
  const detectionResources = Object.fromEntries(Object.entries(standard.bundle.resources).map(([path, target]) => [
    path.replace("../build-resources/standard/", `../build-resources/${stageName(platform)}/`), target,
  ]))
  return {
    ...standard, ...internal,
    build: { beforeBuildCommand: "npm run build" },
    bundle: {
      ...standard.bundle, ...speech.bundle,
      ...(platform === "darwin" ? internal.bundle : {}),
      resources: { ...detectionResources, ...speech.bundle.resources },
    },
  }
}

function main() {
  const platform = process.platform
  const config = offlineConfig(platform)
  const source = resolve(process.argv[2] ?? resolve(root, "build-resources/standard"))
  const python = platform === "win32" ? "python" : "python3"
  execFileSync(python, ["scripts/prepare-standard-package.py", "--source", source,
    "--destination", resolve(root, "build-resources", stageName(platform)),
    platform === "darwin" ? "--with-whisper-mac" : "--with-whisper-windows"], { cwd: root, stdio: "inherit" })
  const environment = { ...process.env, MANNA_FLAVOR: "standard" }
  for (const key of Object.keys(environment)) {
    if (key.startsWith("APPLE_") || key.startsWith("TAURI_SIGNING_PRIVATE_KEY")) delete environment[key]
  }
  // Use the installed CLI directly, without Bun, an npx download, or shell quoting.
  execFileSync(process.execPath, [resolve(root, "node_modules/@tauri-apps/cli/tauri.js"),
    "build", "--ci", "--bundles", platform === "darwin" ? "app,dmg" : "nsis",
    "--config", JSON.stringify(config), "--features", "onnx,whisper,package-check", "--", "--locked"], {
    cwd: root, env: environment, stdio: "inherit",
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
