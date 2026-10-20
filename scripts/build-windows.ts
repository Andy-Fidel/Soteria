import { execFileSync } from "node:child_process"
import { copyFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"

if (process.platform !== "win32") throw new Error("Build the Windows installer on Windows x64.")
if (process.arch !== "x64") throw new Error("Use an x64 Windows build host.")
const root = resolve(import.meta.dirname, "..")
const source = process.argv[2] ? resolve(process.argv[2]) : root
execFileSync("python", ["scripts/prepare-standard-package.py", "--source", source,
  "--destination", "build-resources/windows-standard", "--with-whisper-windows"], { cwd: root, stdio: "inherit" })
const standard = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.standard.json"), "utf8"))
const windows = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.windows-standard.json"), "utf8"))
const resources: Record<string, string> = {}
for (const [from, to] of Object.entries(standard.bundle.resources)) {
  resources[from.replace("build-resources/standard/", "build-resources/windows-standard/")] = to as string
}
Object.assign(resources, windows.bundle.resources)
// App-local Microsoft runtime avoids requiring developer tools on the user's PC.
const redist = process.env.VCToolsRedistDir
if (!redist) throw new Error("VCToolsRedistDir is missing. Run in an x64 Visual Studio developer shell.")
const crt = join(redist, "x64", "Microsoft.VC143.CRT")
const runtime = join(root, "build-resources/windows-runtime")
mkdirSync(runtime, { recursive: true })
const dlls = readdirSync(crt).filter((file) => file.endsWith(".dll"))
if (!dlls.includes("vcruntime140.dll") || !dlls.includes("msvcp140.dll")) throw new Error("Microsoft runtime is incomplete.")
for (const file of dlls) {
  copyFileSync(join(crt, file), join(runtime, file))
  resources[`../build-resources/windows-runtime/${file}`] = file
}
const signCommand = process.env.MANNA_WINDOWS_SIGN_COMMAND
if (process.env.MANNA_REQUIRE_WINDOWS_SIGNING === "true" && !signCommand) throw new Error("Windows publisher signing is required but not configured.")
const config = { ...standard, bundle: { ...standard.bundle, ...windows.bundle, resources,
  windows: { ...windows.bundle.windows, ...(signCommand ? { signCommand } : {}) } } }
execFileSync("bun", ["run", "tauri", "build", "--ci", "--bundles", "nsis", "--target", "x86_64-pc-windows-msvc",
  "--config", JSON.stringify(config), "--features", "onnx,whisper,package-check", "--", "--no-default-features", "--locked"], {
  cwd: root, stdio: "inherit", env: { ...process.env, MANNA_FLAVOR: "standard", STATIC_VCRUNTIME: "false",
    CMAKE_TOOLCHAIN_FILE: join(root, "scripts/windows-cpu.cmake"), CMAKE_POLICY_VERSION_MINIMUM: "3.5" },
})
