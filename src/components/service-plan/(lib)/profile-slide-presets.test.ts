import { expect, it } from "vitest"
import { DEFAULT_CHURCH_PROFILE } from "@/lib/church-profile"
import {
  applyProfilePreset,
  profileTitlePresets,
  profileWelcomeSlide,
} from "./profile-slide-presets"
import { IMAGE_TEXT_PRESETS } from "./image-text-slide"
import { WELCOME_SLIDE } from "./welcome-slide"
it("uses the saved speaker without mutating the bundled slide presets", () => {
  const before = JSON.stringify(IMAGE_TEXT_PRESETS)
  expect(
    profileTitlePresets({
      ...DEFAULT_CHURCH_PROFILE,
      defaultSpeakerName: "Pastor Jane",
    })[0].textOverlay?.body
  ).toBe("Pastor Jane")
  expect(profileTitlePresets(DEFAULT_CHURCH_PROFILE)[0].textOverlay?.body).toBe(
    ""
  )
  expect(JSON.stringify(IMAGE_TEXT_PRESETS)).toBe(before)
})
it("keeps legacy artwork until welcome text is customized", () => {
  const legacy = { ...DEFAULT_CHURCH_PROFILE, legacyEwc: true }
  expect(profileWelcomeSlide(legacy).payload).toBe(WELCOME_SLIDE)
  expect(
    profileWelcomeSlide({ ...legacy, welcomeTitle: "Welcome home" }).payload
      .textOverlay?.title
  ).toBe("Welcome home")
})
it("uses campus identity and custom welcome text in new slides", () => {
  const profile = {
    ...DEFAULT_CHURCH_PROFILE,
    churchName: "Example Church",
    campusName: "North",
  }
  expect(profileWelcomeSlide(profile).payload.textOverlay?.body).toBe(
    "Example Church · North"
  )
  expect(
    profileWelcomeSlide({ ...profile, welcomeMessage: "Sunday service" })
      .payload.textOverlay?.body
  ).toBe("Sunday service")
})

it("copies preset text and images into new slides without changing prior slides", () => {
  const original = { ...WELCOME_SLIDE }
  const profile = {
    ...DEFAULT_CHURCH_PROFILE,
    slidePresets: {
      welcome: {
        imageUrl: "/service-slides/custom.png",
        title: "Welcome home",
        body: "Sunday",
      },
    },
  }
  const saved = profileWelcomeSlide(profile).payload
  expect(saved).toMatchObject({
    imageUrl: "/service-slides/custom.png",
    textOverlay: { title: "Welcome home", body: "Sunday" },
  })
  profile.slidePresets.welcome.title = "Next week"
  expect(saved.textOverlay?.title).toBe("Welcome home")
  expect(WELCOME_SLIDE).toEqual(original)
  expect(
    applyProfilePreset(DEFAULT_CHURCH_PROFILE, "closing", WELCOME_SLIDE)
  ).toBe(WELCOME_SLIDE)
})
