import { parsePlanItem, type ImageSlide, type PlanItem } from "@/types"
import { resolveBrandAsset } from "@/lib/brand"
import type { BrandConfig } from "@/stores/settings-store"
import { prayerImageSlide } from "./prayer-slide"

export function getPlanItemThumbnail(
  item: PlanItem,
  brand: Pick<BrandConfig, "momoImagePath" | "jesusImagePath">
): ImageSlide | null {
  const parsed = parsePlanItem(item)
  if (!parsed) return null
  if (parsed.type === "momo" || parsed.type === "jesus") {
    return {
      url: resolveBrandAsset(
        parsed.type,
        parsed.type === "momo" ? brand.momoImagePath : brand.jesusImagePath
      ),
      label: parsed.type === "momo" ? "MoMo" : "Jesus",
    }
  }
  if (parsed.type !== "blank") return null
  if (parsed.prayer) return prayerImageSlide(item.id, parsed.prayer)
  if (!parsed.imageUrl) return null
  return {
    url: parsed.imageUrl,
    label: parsed.imageLabel ?? "Slide",
    ...(parsed.textOverlay ? { textOverlay: parsed.textOverlay } : {}),
  }
}
