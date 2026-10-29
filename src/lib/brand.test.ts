import { describe, it, expect, vi } from "vitest"

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (p: string) => `asset://localhost/${encodeURIComponent(p)}`,
}))

import { resolveBrandAsset, resolveChurchName, BRAND_DEFAULTS } from "./brand"

describe("resolveBrandAsset", () => {
  it("returns the bundled default when path is null", () => {
    expect(resolveBrandAsset("logo", null)).toBe(BRAND_DEFAULTS.logo)
    expect(resolveBrandAsset("momo", null)).toBe(BRAND_DEFAULTS.momo)
    expect(resolveBrandAsset("jesus", null)).toBe(BRAND_DEFAULTS.jesus)
  })

  it("returns a converted asset URL when a path is set", () => {
    const out = resolveBrandAsset("logo", "/data/brand/logo.png")
    expect(out).toContain("asset://localhost/")
    expect(out).toContain(encodeURIComponent("/data/brand/logo.png"))
  })
})

describe("resolveChurchName", () => {
  it("falls back to Soteria when null/empty/whitespace", () => {
    expect(resolveChurchName(null)).toBe("Soteria")
    expect(resolveChurchName("")).toBe("Soteria")
    expect(resolveChurchName("   ")).toBe("Soteria")
  })
  it("returns the trimmed name when set", () => {
    expect(resolveChurchName("  Grace Chapel  ")).toBe("Grace Chapel")
  })
})

it("defaults Blank to the Soteria logo while preserving explicit background choices", async () => {
  const { resolveBlankBackground } = await import("./brand")
  expect(resolveBlankBackground({ blankImagePath: null })).toEqual({
    imageUrl: "/soteria-logo.png",
    videoUrl: null,
  })
  expect(
    resolveBlankBackground({ blankImagePath: "/brand/blank.png" }).videoUrl
  ).toBeNull()
  const chosen = resolveBlankBackground({
    blankImagePath: null,
    blankBackground: "video",
    blankVideoPath: "/brand/loop.mp4",
  })
  expect(chosen.videoUrl).toContain(encodeURIComponent("/brand/loop.mp4"))
  expect(
    resolveBlankBackground({ blankImagePath: null, blankBackground: "image" })
      .videoUrl
  ).toBeNull()
})
