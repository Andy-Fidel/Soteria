import { convertFileSrc } from "@tauri-apps/api/core"

export const APP_NAME = "Soteria"
export const APP_LOGO_URL = "/soteria-logo.png"
export const APP_REPOSITORY_URL = "https://github.com/Andy-Fidel/Soteria"

// `logo`  = app/sessions logo (landing screen, window chrome).
// `blank` = projector blank-slide image (shown on the broadcast when idle).
// These are intentionally distinct assets with distinct defaults.
export type BrandAssetKind = "logo" | "blank" | "momo" | "jesus"

/** Bundled fallback assets (served from `public/`). Used when no override is set. */
export const BRAND_DEFAULTS: Record<BrandAssetKind, string> = {
  logo: APP_LOGO_URL,
  blank: APP_LOGO_URL,
  momo: "/service-slides/giving-placeholder.svg",
  jesus: "/service-slides/jesus-motion.png",
}

/** Resolve a brand asset to a usable URL: the override (as an `asset:` URL) if
 *  set, otherwise the bundled default. */
export function resolveBrandAsset(
  kind: BrandAssetKind,
  path: string | null
): string {
  if (path && ["/EWC-White.png", "/service-slides/momo.png"].includes(path))
    return path
  return path ? convertFileSrc(path) : BRAND_DEFAULTS[kind]
}

/** Church display name with a sensible fallback. */
export function resolveChurchName(name: string | null): string {
  const trimmed = name?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : APP_NAME
}

export function resolveBlankBackground(brand: {
  blankImagePath: string | null
  blankVideoPath?: string | null
  blankBackground?: "video" | "image"
}): { imageUrl: string; videoUrl: string | null } {
  const mode =
    brand.blankBackground ?? (brand.blankVideoPath ? "video" : "image")
  return {
    imageUrl: resolveBrandAsset("blank", brand.blankImagePath),
    videoUrl:
      mode === "image"
        ? null
        : brand.blankVideoPath
          ? convertFileSrc(brand.blankVideoPath)
          : "/backgrounds/light-refractions.mp4",
  }
}
