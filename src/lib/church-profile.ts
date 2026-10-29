export type SlidePresetId =
  | "welcome"
  | "title"
  | "announcement"
  | "jesus"
  | "closing"
export interface SlidePresetDefault {
  imageUrl: string
  title: string
  body: string
}
export type SlidePresetDefaults = Partial<
  Record<SlidePresetId, SlidePresetDefault>
>

function loadSlidePresets(value: unknown): SlidePresetDefaults {
  if (!value || typeof value !== "object") return {}
  const result: SlidePresetDefaults = {}
  for (const id of [
    "welcome",
    "title",
    "announcement",
    "jesus",
    "closing",
  ] as const) {
    const preset = (value as Record<string, unknown>)[id]
    if (!preset || typeof preset !== "object") continue
    const entry = preset as Record<string, unknown>
    if (
      typeof entry.imageUrl !== "string" ||
      entry.imageUrl.length > 3_000_000 ||
      !/^(data:image\/(png|jpeg|webp);base64,|\/service-slides\/)/.test(
        entry.imageUrl
      )
    )
      continue
    if (
      typeof entry.title !== "string" ||
      entry.title.length > 200 ||
      typeof entry.body !== "string" ||
      entry.body.length > 600
    )
      continue
    result[id] = {
      imageUrl: entry.imageUrl,
      title: entry.title,
      body: entry.body,
    }
  }
  return result
}

export interface BrandConfig {
  slidePresets?: SlidePresetDefaults
  profileVersion?: number
  legacyEwc?: boolean
  churchName: string | null
  campusName?: string | null
  defaultSpeakerName?: string | null
  welcomeTitle?: string | null
  welcomeMessage?: string | null
  logoPath: string | null
  blankImagePath: string | null
  blankVideoPath?: string | null
  blankBackground?: "video" | "image"
  momoImagePath: string | null
  jesusImagePath: string | null
  givingProvider?: string
  givingNumber?: string
  givingAccountName?: string
}
export const DEFAULT_CHURCH_PROFILE: BrandConfig = {
  profileVersion: 2,
  legacyEwc: false,
  churchName: null,
  logoPath: null,
  blankImagePath: null,
  blankBackground: "image",
  momoImagePath: null,
  jesusImagePath: null,
  givingProvider: "",
  givingNumber: "",
  givingAccountName: "",
}

/** Keep existing installations' selected artwork; new installs start neutral. */
export function loadChurchProfile(
  value: unknown,
  existingInstall: boolean
): BrandConfig {
  const saved =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : null
  const legacy =
    Boolean(saved && saved.profileVersion !== 2) || (!saved && existingInstall)
  const string = (key: string) =>
    typeof saved?.[key] === "string" ? (saved[key] as string) : null
  return {
    ...DEFAULT_CHURCH_PROFILE,
    slidePresets: loadSlidePresets(saved?.slidePresets),
    legacyEwc: legacy || saved?.legacyEwc === true,
    churchName: string("churchName"),
    campusName: string("campusName"),
    defaultSpeakerName: string("defaultSpeakerName"),
    welcomeTitle: string("welcomeTitle"),
    welcomeMessage: string("welcomeMessage"),
    logoPath: string("logoPath"),
    blankImagePath:
      string("blankImagePath") || (legacy ? "/EWC-White.png" : null),
    blankVideoPath: string("blankVideoPath"),
    blankBackground:
      saved?.blankBackground === "image" || saved?.blankBackground === "video"
        ? saved.blankBackground
        : string("blankImagePath")
          ? "image"
          : DEFAULT_CHURCH_PROFILE.blankBackground,
    momoImagePath:
      string("momoImagePath") || (legacy ? "/service-slides/momo.png" : null),
    jesusImagePath: string("jesusImagePath"),
    givingProvider: string("givingProvider") ?? "",
    givingNumber: string("givingNumber") ?? "",
    givingAccountName: string("givingAccountName") ?? "",
  }
}
