import type { BrandConfig } from "./church-profile"
import type { ImageSlide } from "@/types"
import { resolveBrandAsset } from "./brand"
function escape(text: string) {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!
  )
}
export function givingSlide(
  brand: Pick<
    BrandConfig,
    "momoImagePath" | "givingProvider" | "givingNumber" | "givingAccountName"
  >
): ImageSlide {
  if (brand.momoImagePath)
    return {
      url: resolveBrandAsset("momo", brand.momoImagePath),
      label: "Giving",
    }
  const number = brand.givingNumber?.trim() ?? ""
  if (!number) return { url: resolveBrandAsset("momo", null), label: "Giving" }
  const provider = escape(
    (brand.givingProvider?.trim() || "Giving").toUpperCase()
  )
  const name = escape(brand.givingAccountName?.trim() || "")
  const numberSize = Math.max(
    40,
    Math.min(154, (1500 / Math.max(number.length, 1)) * 1.3)
  )
  const nameSize = Math.max(
    24,
    Math.min(
      54,
      (1450 / Math.max((brand.givingAccountName?.trim() || "").length, 1)) * 1.5
    )
  )
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"><rect width="1920" height="1080" fill="#101010"/><g fill="#eae1c5" text-anchor="middle" font-family="Arial,sans-serif"><text x="960" y="330" font-size="40" letter-spacing="5">${provider}</text><text x="960" y="560" font-size="${numberSize}" font-weight="800">${escape(number)}</text><path d="M760 655h400" stroke="#eae1c5" stroke-width="2" opacity=".45"/><text x="960" y="760" font-size="${nameSize}">${name}</text></g></svg>`
  return {
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    label: "Giving",
  }
}
