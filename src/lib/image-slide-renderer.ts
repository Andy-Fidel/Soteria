import { getSpeakerPortraitUrl } from "./speaker-portrait"
import type { ImageSlide } from "@/types"

/** Shared by preview and projector so image/text geometry is identical. */
export function drawImageSlide(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  slide: ImageSlide,
  width: number,
  height: number,
  portrait?: HTMLImageElement,
  logoMark?: HTMLImageElement
) {
  ctx.save()
  ctx.fillStyle = "#000000"
  ctx.fillRect(0, 0, width, height)
  const ratio =
    image?.naturalWidth && image.naturalHeight
      ? image.naturalWidth / image.naturalHeight
      : 16 / 9
  const imageWidth = Math.min(width, height * ratio)
  const imageHeight = imageWidth / ratio
  const left = (width - imageWidth) / 2
  const top = (height - imageHeight) / 2
  if (image?.complete && image.naturalWidth > 0)
    ctx.drawImage(image, left, top, imageWidth, imageHeight)
  const showPortrait = Boolean(
    getSpeakerPortraitUrl(slide) &&
    portrait?.complete &&
    portrait.naturalWidth > 0
  )
  if (showPortrait && portrait) {
    // The approved photo, grain and interwoven rays share one cached background.
    ctx.drawImage(portrait, left, top, imageWidth, imageHeight)
    if (logoMark?.complete && logoMark.naturalHeight > 0) {
      const size = imageHeight * 0.065
      // The symbol occupies the left square of the bundled EWC wordmark.
      ctx.drawImage(
        logoMark,
        0,
        0,
        logoMark.naturalHeight,
        logoMark.naturalHeight,
        left + (imageWidth - size) / 2,
        top + imageHeight * 0.978 - size,
        size,
        size
      )
    }
  }
  const overlay = slide.textOverlay
  const lines: Array<{
    text: string
    x: number
    y: number
    fontSize: number
    lineHeight: number
    align?: CanvasTextAlign
  }> = []
  if (overlay?.layout === "prayer") {
    const maxWidth = imageWidth * 0.56
    let fontSize = imageWidth * 0.098
    let wrapped: string[] = []
    for (let attempt = 0; attempt < 20; attempt++) {
      ctx.font = `600 ${fontSize}px "Inter Variable", Arial, sans-serif`
      ctx.letterSpacing = `${-fontSize * 0.035}px`
      wrapped = wrap(ctx, overlay.body.toUpperCase(), maxWidth)
      if (wrapped.length * fontSize * 1.02 <= imageHeight * 0.7) break
      fontSize *= 0.94
    }
    const x = left + imageWidth * 0.078
    const startY = top + (imageHeight - wrapped.length * fontSize * 1.02) / 2
    ctx.fillStyle = "#ffffff"
    ctx.textAlign = "left"
    ctx.textBaseline = "top"
    wrapped.forEach((text, index) => {
      const y = startY + index * fontSize * 1.02
      ctx.fillText(text, x, y)
      lines.push({ text, x, y, fontSize, lineHeight: fontSize * 1.02 })
    })
    ctx.fillStyle = "rgba(255,255,255,0.5)"
    ctx.font = `600 ${imageWidth * 0.015}px "Inter Variable", Arial, sans-serif`
    ctx.letterSpacing = "0px"
    ctx.fillText(overlay.title, x, top + imageHeight * 0.09)
    ctx.restore()
    return lines
  }
  if (overlay) {
    const maxWidth = imageWidth * 0.84
    const safeBottom = top + imageHeight * 0.54
    let factor = 1
    for (let attempt = 0; attempt < 40; attempt++) {
      lines.length = 0
      if (overlay.layout === "title") {
        const fontSize = imageWidth * 0.098 * factor
        const lineHeight = fontSize * 1.02
        ctx.font = `600 ${fontSize}px "Inter Variable", Arial, sans-serif`
        ctx.letterSpacing = `${-fontSize * 0.035}px`
        const titleLines = wrap(ctx, overlay.title.toUpperCase(), maxWidth)
        const speakerLines = (showPortrait ? "" : overlay.body)
          .toUpperCase()
          .trim()
          .split(/\s+/)
          .filter(Boolean)
        const speakerFontSize = imageWidth * 0.0441
        const speakerLineHeight = speakerFontSize * 1.02
        const speakerBottom = top + imageHeight * 0.94
        titleLines.forEach((text, index) => {
          lines.push({
            text,
            x: width / 2,
            y: top + imageHeight * 0.06 + index * lineHeight,
            fontSize,
            lineHeight,
          })
        })
        speakerLines.forEach((text, index) => {
          lines.push({
            text,
            x: left + imageWidth * 0.08,
            y:
              speakerBottom - (speakerLines.length - index) * speakerLineHeight,
            fontSize: speakerFontSize,
            lineHeight: speakerLineHeight,
            align: "left",
          })
        })
        if (titleLines.length * lineHeight <= imageHeight * 0.42) break
        factor *= 0.9
        continue
      }
      let y = top + imageHeight * 0.06
      for (const [index, text] of [overlay.title, overlay.body].entries()) {
        if (!text.trim()) continue
        const relativeSize = index === 0 ? 0.082 : 0.047
        const fontSize = imageWidth * relativeSize * factor
        const lineHeight = fontSize * 1.02
        ctx.font = `600 ${fontSize}px "Inter Variable", Arial, sans-serif`
        ctx.letterSpacing = `${-fontSize * 0.035}px`
        for (const line of wrap(ctx, text.toUpperCase(), maxWidth)) {
          lines.push({ text: line, x: width / 2, y, fontSize, lineHeight })
          y += lineHeight
        }
        y += imageHeight * 0.012 * factor
      }
      if (y <= safeBottom) break
      factor *= 0.9
    }
    ctx.fillStyle = "#ecdfc1"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    for (const line of lines) {
      ctx.fillStyle =
        line.align === "left" ? "rgba(236, 223, 193, 0.7)" : "#ecdfc1"
      ctx.font = `${line.align === "left" ? 400 : 600} ${line.fontSize}px "Inter Variable", Arial, sans-serif`
      ctx.letterSpacing = `${-line.fontSize * 0.035}px`
      ctx.textAlign = line.align ?? "center"
      ctx.fillText(line.text, line.x, line.y)
    }
  }
  ctx.restore()
  return lines
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number
): string[] {
  const lines: string[] = []
  for (const paragraph of text.split("\n")) {
    let line = ""
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= width) {
        line = candidate
        continue
      }
      if (line) {
        lines.push(line)
        line = ""
      }
      for (const character of word) {
        if (line && ctx.measureText(line + character).width > width) {
          lines.push(line)
          line = ""
        }
        line += character
      }
    }
    lines.push(line)
  }
  return lines
}
