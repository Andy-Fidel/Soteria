import { expect, it, vi } from "vitest"
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
}))
import { givingSlide } from "./giving-slide"
import { DEFAULT_CHURCH_PROFILE, loadChurchProfile } from "./church-profile"
it("shows no real payment number for a new installation", () => {
  expect(givingSlide(DEFAULT_CHURCH_PROFILE).url).toBe(
    "/service-slides/giving-placeholder.svg"
  )
})
it("preserves the legacy giving image and custom uploaded images", () => {
  expect(givingSlide(loadChurchProfile({}, true)).url).toBe(
    "/service-slides/momo.png"
  )
  expect(givingSlide({ momoImagePath: "/custom.png" }).url).toBe(
    "asset:/custom.png"
  )
})
it("renders only the configured giving details and escapes markup", () => {
  const slide = givingSlide({
    momoImagePath: null,
    givingProvider: "MTN & Bank",
    givingNumber: "0123456789",
    givingAccountName: 'Church <script> & "name"',
  })
  const svg = decodeURIComponent(slide.url.split(",")[1])
  expect(svg).toContain("0123456789")
  expect(svg).toContain("MTN &amp; BANK")
  expect(svg).toContain("&lt;script&gt;")
  expect(svg).not.toContain("<script>")
  expect(svg).not.toContain("024 006 8152")
})

it("restores the approved original for an existing EWC profile with empty giving fields", () => {
  expect(givingSlide({ ...DEFAULT_CHURCH_PROFILE, legacyEwc: true }).url).toBe(
    "/service-slides/momo.png"
  )
  expect(givingSlide({ ...DEFAULT_CHURCH_PROFILE, legacyEwc: false }).url).toBe(
    "/service-slides/giving-placeholder.svg"
  )
  expect(
    givingSlide({
      ...DEFAULT_CHURCH_PROFILE,
      legacyEwc: true,
      givingNumber: "0123456789",
    }).url
  ).toContain("data:image/svg+xml")
})
