import { expect, it } from "vitest"
import { loadChurchProfile, DEFAULT_CHURCH_PROFILE } from "./church-profile"
it("starts new installations without EWC artwork or payment details", () => {
  const profile = loadChurchProfile(null, false)
  expect(profile.legacyEwc).toBe(false)
  expect(profile.momoImagePath).toBeNull()
  expect(profile.blankImagePath).toBeNull()
  expect(profile.givingNumber).toBe("")
})
it("preserves the existing EWC setup and custom assets during migration", () => {
  const profile = loadChurchProfile(
    {
      churchName: "EWC Adentan",
      logoPath: "/brand/logo.png",
      blankBackground: "video",
    },
    true
  )
  expect(profile).toMatchObject({
    profileVersion: 2,
    legacyEwc: true,
    churchName: "EWC Adentan",
    logoPath: "/brand/logo.png",
    blankImagePath: "/EWC-White.png",
    blankBackground: "video",
    momoImagePath: "/service-slides/momo.png",
  })
  expect(loadChurchProfile(null, true).momoImagePath).toBe(
    "/service-slides/momo.png"
  )
})
it("does not restore bundled payment details after the user clears them", () => {
  const profile = {
    ...DEFAULT_CHURCH_PROFILE,
    legacyEwc: true,
    momoImagePath: null,
    givingProvider: "MTN",
    givingNumber: "0123456789",
    givingAccountName: "Example church",
  }
  expect(loadChurchProfile(profile, true)).toMatchObject(profile)
  expect(
    loadChurchProfile({ ...profile, givingNumber: "" }, true).givingNumber
  ).toBe("")
})
