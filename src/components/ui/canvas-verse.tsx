import { startLoopingVideo, drawVideoCover } from "@/lib/looping-video"
import { useRef, useEffect, useState, memo } from "react"
import { renderVerse, type VerseLayoutMetrics } from "@/lib/verse-renderer"
import type { BroadcastTheme, VerseRenderData } from "@/types"
import { cn } from "@/lib/utils"
import { renderAndReport } from "@/lib/canvas-render-result"

const sharedImageCache = new Map<string, HTMLImageElement>()
const pendingImageLoads = new Map<string, Promise<HTMLImageElement>>()

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

function ensureImage(url: string, onReady?: () => void) {
  if (sharedImageCache.has(url)) return
  const pending = pendingImageLoads.get(url)
  if (pending) {
    void pending.then(() => onReady?.()).catch(() => {})
    return
  }
  const req = loadImage(url)
    .then((img) => {
      sharedImageCache.set(url, img)
      onReady?.()
      return img
    })
    .finally(() => pendingImageLoads.delete(url))
  pendingImageLoads.set(url, req)
}

interface CanvasVerseProps {
  theme: BroadcastTheme
  verse: VerseRenderData | null
  fullscreenImage?: { url: string; label: string } | null
  blankLogo?: boolean
  blankLogoLabel?: string
  blankVideoUrl?: string | null
  blankLogoUrl?: string
  className?: string
  onRenderResult?: (result: VerseLayoutMetrics | null) => void
}

export const CanvasVerse = memo(function CanvasVerse({
  theme,
  verse,
  fullscreenImage = null,
  blankLogo = false,
  blankVideoUrl = null,
  blankLogoLabel = "Adenta Campus",
  blankLogoUrl = "/EWC-White.png",
  className,
  onRenderResult,
}: CanvasVerseProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Measure container width with ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0
      if (w > 0) setContainerWidth(w)
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Render to canvas at display size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || containerWidth === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const aspectRatio = theme.resolution.width / theme.resolution.height
    const displayW = containerWidth
    const displayH = displayW / aspectRatio

    canvas.width = displayW * dpr
    canvas.height = displayH * dpr
    canvas.style.width = `${displayW}px`
    canvas.style.height = `${displayH}px`

    ctx.scale(dpr, dpr)
    const scale = displayW / theme.resolution.width

    const drawFullscreenImage = (cx: CanvasRenderingContext2D, w: number, h: number) => {
      cx.fillStyle = "#000"
      cx.fillRect(0, 0, w, h)
      if (!fullscreenImage) return
      const img = sharedImageCache.get(fullscreenImage.url)
      if (!img || !img.complete || img.naturalWidth === 0) return
      const imgAspect = img.naturalWidth / img.naturalHeight
      const canvasAspect = w / h
      let dw = w
      let dh = h
      if (imgAspect > canvasAspect) dh = w / imgAspect
      else dw = h * imgAspect
      cx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
    }

    let videoLoop: ReturnType<typeof startLoopingVideo> | undefined
    let active = true

    const drawBlankLogo = (cx: CanvasRenderingContext2D, w: number, h: number) => {
      cx.fillStyle = "#000"
      cx.fillRect(0, 0, w, h)
      if (drawVideoCover(cx, videoLoop?.video ?? null, w, h)) return
      const img = sharedImageCache.get(blankLogoUrl)
      if (img && img.complete && img.naturalWidth > 0) {
        const target = Math.min(w, h) * 0.99
        const aspect = img.naturalWidth / img.naturalHeight
        const logoW = aspect >= 1 ? target : target * aspect
        const logoH = aspect >= 1 ? target / aspect : target
        cx.drawImage(img, (w - logoW) / 2, (h - logoH) / 2, logoW, logoH)
      }
    }

    const rerender = () => {
      if (!active) return
      const c = canvasRef.current
      const cx = c?.getContext("2d")
      if (!c || !cx) return
      cx.setTransform(1, 0, 0, 1, 0, 0)
      cx.clearRect(0, 0, c.width, c.height)
      cx.scale(dpr, dpr)
      if (fullscreenImage) {
        onRenderResult?.(null)
        drawFullscreenImage(cx, theme.resolution.width * scale, theme.resolution.height * scale)
        return
      }
      if (blankLogo) {
        onRenderResult?.(null)
        drawBlankLogo(cx, theme.resolution.width * scale, theme.resolution.height * scale)
        return
      }
      renderAndReport(
        () => renderVerse(cx, theme, verse, { scale, imageCache: sharedImageCache, collectWordHits: Boolean(onRenderResult) }),
        onRenderResult,
      )
    }

    if (blankLogo && blankVideoUrl && !fullscreenImage) {
      videoLoop = startLoopingVideo(blankVideoUrl, rerender, rerender)
    }

    if (theme.background.type === "image" && theme.background.image?.url) {
      ensureImage(theme.background.image.url, rerender)
    }
    if (theme.logo?.url) {
      ensureImage(theme.logo.url, rerender)
    }
    if (fullscreenImage?.url) {
      ensureImage(fullscreenImage.url, rerender)
    }
    if (blankLogo) {
      ensureImage(blankLogoUrl, rerender)
    }

    if (fullscreenImage) {
      onRenderResult?.(null)
      drawFullscreenImage(ctx, theme.resolution.width * scale, theme.resolution.height * scale)
    } else if (blankLogo) {
      onRenderResult?.(null)
      drawBlankLogo(ctx, theme.resolution.width * scale, theme.resolution.height * scale)
    } else {
      renderAndReport(
        () => renderVerse(ctx, theme, verse, { scale, imageCache: sharedImageCache, collectWordHits: Boolean(onRenderResult) }),
        onRenderResult,
      )
    }
    return () => { active = false; videoLoop?.stop() }
  }, [theme, verse, fullscreenImage, blankLogo, blankLogoLabel, blankLogoUrl, blankVideoUrl, containerWidth, onRenderResult])

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      <canvas ref={canvasRef} className="w-full rounded-md" />
    </div>
  )
})
