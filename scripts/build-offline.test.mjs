import assert from "node:assert/strict"
import test from "node:test"
import { offlineConfig } from "./build-offline.mjs"

for (const [platform, stage] of [["darwin", "standard"], ["win32", "windows-standard"]]) {
  test(`${platform} packages speech and detection from one verified resource stage`, () => {
    const config = offlineConfig(platform)
    const resources = config.bundle.resources
    assert.ok(Object.keys(resources).every((source) => source.startsWith(`../build-resources/${stage}/`)))
    assert.ok(Object.values(resources).includes("models/whisper/"))
    assert.ok(Object.values(resources).includes("data/rhema.db"))
    assert.ok(Object.values(resources).includes("standard-package.json"))
    assert.deepEqual(config.plugins.updater.endpoints, [])
    assert.equal(config.build.beforeBuildCommand, "npm run build")
  })
}
test("unsupported installer platforms fail explicitly", () => {
  assert.throws(() => offlineConfig("linux"), /Linux packaging needs separate validation/)
})

test("Windows installer includes WebView for disconnected installation", () => {
  assert.equal(offlineConfig("win32").bundle.windows.webviewInstallMode.type, "offlineInstaller")
})
