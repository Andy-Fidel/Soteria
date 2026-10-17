import { describe, expect, it } from "vitest"
import { BUNDLED_HYMN_COUNTS, AVAILABLE_HYMNALS, canEnableHymnal } from "./hymnal-availability"
import { HYMNAL_SOURCES } from "@/types"

const bundles = import.meta.glob<{ hymns: unknown[] }>("../../src-tauri/hymnals/*.json", { eager: true, import: "default" })

describe("bundled hymnal availability", () => {
  it.each(HYMNAL_SOURCES)("reports the actual %s bundle count", (id) => {
    const bundle = bundles[`../../src-tauri/hymnals/${id}.json`]
    expect(BUNDLED_HYMN_COUNTS[id]).toBe(bundle.hymns.length)
  })
  it("offers only nonempty bundles on first setup", () => {
    expect(AVAILABLE_HYMNALS).toEqual(["ghs", "sda"])
    expect(canEnableHymnal("mhb", 0)).toBe(false)
  })
  it("keeps previously installed hymns usable even when the bundle is empty", () => {
    expect(canEnableHymnal("mhb", 50)).toBe(true)
  })
})
