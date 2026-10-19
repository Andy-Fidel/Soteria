import type { BroadcastTheme } from "@/types/broadcast"

/** Three sliding box passes approximate Gaussian blur in WebKit without ctx.filter. */
export function filterBackgroundPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  brightness: number,
  blur: number
) {
  const radius = Math.max(0, Math.min(50, Math.round(blur)))
  if (radius) {
    // Blur premultiplied channels so translucent image edges do not gain dark halos.
    for (let i = 0; i < data.length; i += 4)
      for (let c = 0; c < 3; c++)
        data[i + c] = (data[i + c] * data[i + 3]) / 255
    const scratch = new Uint8ClampedArray(data.length)
    const pass = (
      source: Uint8ClampedArray,
      target: Uint8ClampedArray,
      horizontal: boolean
    ) => {
      const lines = horizontal ? height : width,
        length = horizontal ? width : height
      const step = horizontal ? 4 : width * 4
      const divisor = radius * 2 + 1
      for (let line = 0; line < lines; line++) {
        const offset = horizontal ? line * width * 4 : line * 4
        let r = 0,
          g = 0,
          b = 0,
          a = 0
        for (let k = -radius; k <= radius; k++) {
          const index = offset + Math.max(0, Math.min(length - 1, k)) * step
          r += source[index]
          g += source[index + 1]
          b += source[index + 2]
          a += source[index + 3]
        }
        for (let n = 0; n < length; n++) {
          const index = offset + n * step
          target[index] = r / divisor
          target[index + 1] = g / divisor
          target[index + 2] = b / divisor
          target[index + 3] = a / divisor
          const add = offset + Math.min(length - 1, n + radius + 1) * step
          const drop = offset + Math.max(0, n - radius) * step
          r += source[add] - source[drop]
          g += source[add + 1] - source[drop + 1]
          b += source[add + 2] - source[drop + 2]
          a += source[add + 3] - source[drop + 3]
        }
      }
    }
    for (let i = 0; i < 3; i++) {
      pass(data, scratch, true)
      pass(scratch, data, false)
    }
    for (let i = 0; i < data.length; i += 4)
      if (data[i + 3])
        for (let c = 0; c < 3; c++)
          data[i + c] = (data[i + c] * 255) / data[i + 3]
  }
  if (brightness !== 100)
    for (let i = 0; i < data.length; i += 4)
      for (let c = 0; c < 3; c++) data[i + c] = (data[i + c] * brightness) / 100
}

const unreadable = new WeakSet<HTMLImageElement>()
const processed = new WeakMap<
  HTMLImageElement,
  { key: string; canvas: HTMLCanvasElement }
>()
/** Cache the processed bitmap; slider changes replace it rather than accumulating copies. */
export function backgroundWithEffects(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  settings: NonNullable<BroadcastTheme["background"]["image"]>,
  drawWidth: number,
  drawHeight: number
): CanvasImageSource {
  if (
    unreadable.has(image) ||
    typeof ctx.filter === "string" ||
    (!settings.blur && settings.brightness === 100) ||
    typeof document === "undefined"
  )
    return image
  const key = `${settings.blur}:${settings.brightness}:${Math.round(drawWidth)}:${Math.round(drawHeight)}`
  const saved = processed.get(image)
  if (saved?.key === key) return saved.canvas
  const canvas = saved?.canvas ?? document.createElement("canvas")
  // Work at output scale; decoding a huge photo must not make every edit expensive.
  const limitWidth = settings.blur > 0 ? 1024 : 1920
  const limitHeight = settings.blur > 0 ? 576 : 1080
  const ratio = Math.min(1, limitWidth / drawWidth, limitHeight / drawHeight)
  canvas.width = Math.max(1, Math.round(drawWidth * ratio))
  canvas.height = Math.max(1, Math.round(drawHeight * ratio))
  const target = canvas.getContext("2d", { willReadFrequently: true })
  if (!target) return image
  target.drawImage(image, 0, 0, canvas.width, canvas.height)
  let pixels: ImageData
  try {
    pixels = target.getImageData(0, 0, canvas.width, canvas.height)
  } catch {
    // Cross-origin legacy images can be displayed but cannot be sampled.
    // Preserve the image instead of turning the entire projector frame black.
    unreadable.add(image)
    console.warn(
      "[theme] Upload a local copy of this image to enable image effects."
    )
    return image
  }
  filterBackgroundPixels(
    pixels.data,
    canvas.width,
    canvas.height,
    settings.brightness,
    settings.blur > 0 ? Math.max(1, settings.blur * ratio) : 0
  )
  target.putImageData(pixels, 0, 0)
  processed.set(image, { key, canvas })
  return canvas
}
