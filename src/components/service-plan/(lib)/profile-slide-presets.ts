import type { BrandConfig, SlidePresetId } from "@/lib/church-profile"
import type { PlanItemBlank } from "@/types"
import { IMAGE_TEXT_PRESETS, STARBURST_BACKGROUND } from "./image-text-slide"
import { WELCOME_SLIDE } from "./welcome-slide"

export function profileTitlePresets(brand: BrandConfig): PlanItemBlank[] {
  return IMAGE_TEXT_PRESETS.map((original) =>
    applyProfilePreset(
      brand,
      original.textOverlay?.layout === "title" ? "title" : "announcement",
      original.textOverlay?.layout === "title"
        ? {
            ...original,
            textOverlay: {
              ...original.textOverlay,
              body:
                brand.defaultSpeakerName ??
                (brand.legacyEwc ? original.textOverlay.body : ""),
            },
          }
        : original
    )
  )
}

export function profileWelcomeSlide(brand: BrandConfig): {
  label: string
  image: string
  payload: PlanItemBlank
} {
  const custom = brand.slidePresets?.welcome
  if (custom) {
    const payload = applyProfilePreset(brand, "welcome", {
      type: "blank",
      showLogo: false,
      imageUrl: STARBURST_BACKGROUND,
      imageLabel: "Welcome",
      textOverlay: { layout: "announcement", title: "Welcome", body: "" },
    })
    return { label: "Welcome", image: payload.imageUrl!, payload }
  }
  if (brand.legacyEwc && !brand.welcomeTitle && !brand.welcomeMessage)
    return {
      label: "EWC Adenta — Welcome",
      image: WELCOME_SLIDE.imageUrl!,
      payload: WELCOME_SLIDE,
    }
  return {
    label: brand.welcomeTitle || "Welcome",
    image: STARBURST_BACKGROUND,
    payload: {
      type: "blank",
      showLogo: false,
      imageUrl: STARBURST_BACKGROUND,
      imageLabel: "Welcome",
      textOverlay: {
        layout: "announcement",
        title: brand.welcomeTitle || "Welcome",
        body:
          brand.welcomeMessage ??
          [brand.churchName, brand.campusName].filter(Boolean).join(" · "),
      },
    },
  }
}

/** Copy defaults into a new slide. Saved service-plan items remain independent. */
export function applyProfilePreset(
  brand: BrandConfig,
  id: SlidePresetId,
  original: PlanItemBlank
): PlanItemBlank {
  const preset = brand.slidePresets?.[id]
  if (!preset) return original
  const layout = original.textOverlay?.layout ?? "announcement"
  return {
    ...original,
    imageUrl: preset.imageUrl,
    ...(original.textOverlay || preset.title.trim() || preset.body.trim()
      ? { textOverlay: { layout, title: preset.title, body: preset.body } }
      : {}),
  }
}
