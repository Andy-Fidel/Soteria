/** Remove color-channel alpha without changing the selected text color. */
export function opaqueTextColor(value: string): string {
  const color = value.trim()
  if (color.toLowerCase() === "transparent") return "#000000"
  if (/^#[\da-f]{8}$/i.test(color)) return color.slice(0, 7)
  if (/^#[\da-f]{4}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }
  const functional = color.match(/^(rgba?|hsla?)\((.*)\)$/i)
  if (functional) {
    const name = functional[1].toLowerCase().replace(/a$/, "")
    const channels = functional[2].split("/")[0].trim().split(",")
    return `${name}(${channels.slice(0, 3).join(",")})`
  }
  // CSS color(), lab() and oklch() use a slash before the alpha channel.
  return color.replace(/\s*\/\s*[^)]+\)$/, ")")
}
