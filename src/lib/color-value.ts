export function parseColorOpacity(color: string): {
  hex: string
  opacity: number
} {
  const value = color.trim()
  if (/^#[\da-f]{3,4}$/i.test(value))
    return parseColorOpacity(
      "#" + [...value.slice(1)].map((c) => c + c).join("")
    )
  if (/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value))
    return {
      hex: value.slice(0, 7),
      opacity:
        value.length === 9
          ? Math.round((parseInt(value.slice(7), 16) / 255) * 100)
          : 100,
    }
  const rgb = value.match(/^rgba?\((.*)\)$/i)
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean)
    if (parts.length >= 3) {
      const channel = (part: string) =>
        Math.min(
          255,
          Math.max(
            0,
            Math.round(parseFloat(part) * (part.endsWith("%") ? 2.55 : 1))
          )
        )
          .toString(16)
          .padStart(2, "0")
      const alpha = parts[3]
        ? parseFloat(parts[3]) * (parts[3].endsWith("%") ? 1 : 100)
        : 100
      return {
        hex: "#" + parts.slice(0, 3).map(channel).join(""),
        opacity: Math.min(100, Math.max(0, Math.round(alpha))),
      }
    }
  }
  if (value === "transparent") return { hex: "#000000", opacity: 0 }
  if (typeof document !== "undefined") {
    const ctx = document.createElement("canvas").getContext("2d")
    if (ctx) {
      ctx.fillStyle = value
      const canonical = ctx.fillStyle
      if (canonical !== value) return parseColorOpacity(canonical)
    }
  }
  return { hex: value === "white" ? "#ffffff" : "#000000", opacity: 100 }
}
export function buildColorWithOpacity(hex: string, opacity: number): string {
  const color = parseColorOpacity(hex).hex
  return opacity >= 100
    ? color
    : color +
        Math.round((Math.max(0, opacity) / 100) * 255)
          .toString(16)
          .padStart(2, "0")
}
