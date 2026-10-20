export interface BrandConfig {
  profileVersion?: number
  legacyEwc?: boolean
  churchName: string | null
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
    legacyEwc: legacy || saved?.legacyEwc === true,
    churchName: string("churchName"),
    logoPath: string("logoPath"),
    blankImagePath:
      string("blankImagePath") || (legacy ? "/EWC-White.png" : null),
    blankVideoPath: string("blankVideoPath"),
    blankBackground:
      saved?.blankBackground === "image" || saved?.blankBackground === "video"
        ? saved.blankBackground
        : string("blankImagePath")
          ? "image"
          : "video",
    momoImagePath:
      string("momoImagePath") || (legacy ? "/service-slides/momo.png" : null),
    jesusImagePath: string("jesusImagePath"),
    givingProvider: string("givingProvider") ?? "",
    givingNumber: string("givingNumber") ?? "",
    givingAccountName: string("givingAccountName") ?? "",
  }
}
