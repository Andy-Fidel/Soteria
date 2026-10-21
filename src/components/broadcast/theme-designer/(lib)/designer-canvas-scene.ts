import * as fabric from "fabric"
import { ensureDesignerImage as ensureImage } from "./designer-images"
import type { MutableRefObject } from "react"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { renderVerse } from "@/lib/verse-renderer"
import type { BroadcastTheme, VerseRenderData } from "@/types"
/** Sync BroadcastTheme properties to existing Fabric objects */
export function syncThemeToCanvas(
  theme: BroadcastTheme,
  objectsRef: MutableRefObject<{
    workspace: fabric.Rect | null
    referenceRegion: fabric.Rect | null
    verseRegion: fabric.Rect | null
  }>,
  canvas: fabric.Canvas,
  imageCache: Map<string, HTMLImageElement>,
  imageRequests: Map<string, Promise<HTMLImageElement>>,
  rendering: DesignerRender,
  onImageReady?: () => void
) {
  const ws = objectsRef.current.workspace
  const refRegion = objectsRef.current.referenceRegion
  const verseRegion = objectsRef.current.verseRegion
  if (!ws || !refRegion || !verseRegion) return

  if (theme.background.type === "image" && theme.background.image?.url) {
    const img = imageCache.get(theme.background.image.url)
    if (!img) {
      ensureImage(
        theme.background.image.url,
        imageCache,
        imageRequests,
        onImageReady
      )
    }
  }
  if (theme.logo?.url) {
    const img = imageCache.get(theme.logo.url)
    if (!img) {
      ensureImage(theme.logo.url, imageCache, imageRequests, onImageReady)
    }
  }

  const { bitmap, metrics } = renderThemeBitmap(theme, imageCache, rendering)
  ws.set({
    fill: new fabric.Pattern({
      source: bitmap,
      repeat: "no-repeat",
    }),
  })
  ws.dirty = true

  if (!metrics) return
  const referenceRect = metrics.referenceRect
  const verseRect = metrics.verseRect
  refRegion.set({
    visible: Boolean(referenceRect),
    evented: Boolean(referenceRect),
  })
  if (!verseRect) return
  if (!referenceRect) {
    refRegion.set({ width: 0, height: 0 })
    verseRegion.set({
      left: ws.left + verseRect.x,
      top: ws.top + verseRect.y,
      width: verseRect.width,
      height: verseRect.height,
    })
    verseRegion.setCoords()
    canvas.renderAll()
    return
  }

  ws.setCoords()
  const wsTopLeft = ws.getPointByOrigin("left", "top")
  const tightenedRects = tightenTextHitRects(
    referenceRect,
    verseRect,
    metrics.scaledTheme
  )
  const mappedReferenceRect = mapLocalRectToWorkspaceRect(
    tightenedRects.referenceRect,
    wsTopLeft,
    theme.resolution
  )
  const mappedVerseRect = mapLocalRectToWorkspaceRect(
    tightenedRects.verseRect,
    wsTopLeft,
    theme.resolution
  )

  refRegion.set({
    originX: "left",
    originY: "top",
    width: Math.max(24, mappedReferenceRect.width),
    height: Math.max(20, mappedReferenceRect.height),
  })
  refRegion.setPositionByOrigin(
    new fabric.Point(mappedReferenceRect.x, mappedReferenceRect.y),
    "left",
    "top"
  )
  verseRegion.set({
    originX: "left",
    originY: "top",
    width: Math.max(24, mappedVerseRect.width),
    height: Math.max(24, mappedVerseRect.height),
  })
  verseRegion.setPositionByOrigin(
    new fabric.Point(mappedVerseRect.x, mappedVerseRect.y),
    "left",
    "top"
  )
  canvas.bringObjectToFront(verseRegion)
  canvas.bringObjectToFront(refRegion)

  const selected = useBroadcastStore.getState().selectedElement
  refRegion.set({
    strokeWidth: selected === "reference" ? 2 : 1,
    stroke: selected === "reference" ? "#f59e0b" : "rgba(245, 158, 11, 0.4)",
  })
  verseRegion.set({
    strokeWidth: selected === "verse" ? 2 : 1,
    stroke: selected === "verse" ? "#f59e0b" : "rgba(245, 158, 11, 0.4)",
  })
  refRegion.setCoords()
  verseRegion.setCoords()

  canvas.renderAll()
}

function mapLocalRectToWorkspaceRect(
  localRect: { x: number; y: number; width: number; height: number },
  wsTopLeft: fabric.Point,
  { width, height }: { width: number; height: number }
) {
  const clampedWidth = clamp(localRect.width, 0, width)
  const clampedHeight = clamp(localRect.height, 0, height)
  const localX = clamp(localRect.x, 0, Math.max(0, width - clampedWidth))
  const localY = clamp(localRect.y, 0, Math.max(0, height - clampedHeight))

  return {
    x: wsTopLeft.x + localX,
    y: wsTopLeft.y + localY,
    width: clampedWidth,
    height: clampedHeight,
  }
}

function tightenTextHitRects(
  referenceRect: { x: number; y: number; width: number; height: number },
  verseRect: { x: number; y: number; width: number; height: number },
  theme: BroadcastTheme
) {
  const refFont = Math.max(1, theme.reference.fontSize)
  const verseFont = Math.max(1, theme.verseText.fontSize)
  const verseExtraLeading =
    Math.max(0, theme.verseText.lineHeight - 1) * verseFont
  const referenceGap = Math.max(0, theme.layout.referenceGap ?? 0)
  const refPadX = Math.max(6, refFont * 0.25)
  const refPadTop = Math.max(2, refFont * 0.2)
  const refPadBottom = Math.max(0, refFont * 0)

  // Renderer rects include spacing blocks; trim to closer glyph hit areas for designer selection.
  const referenceTight = {
    x: referenceRect.x - refPadX,
    y: referenceRect.y + refFont * 0.22 - refPadTop,
    width: referenceRect.width + refPadX * 2,
    height:
      Math.max(refFont * 1.05, referenceRect.height - refFont * 0.42) +
      refPadTop +
      refPadBottom,
  }
  const verseTight = {
    x: verseRect.x,
    y: verseRect.y + verseFont * 0.12,
    width: verseRect.width,
    height: Math.max(
      verseFont,
      verseRect.height - verseExtraLeading - verseFont * 0.1
    ),
  }

  if (!theme.reference.standalone && theme.reference.position === "above") {
    const minVerseY = referenceTight.y + referenceTight.height + referenceGap
    verseTight.y = Math.max(verseTight.y, minVerseY)
  } else if (
    !theme.reference.standalone &&
    theme.reference.position === "below"
  ) {
    const minRefY = verseTight.y + verseTight.height + referenceGap
    referenceTight.y = Math.max(referenceTight.y, minRefY)
  }

  return {
    referenceRect: referenceTight,
    verseRect: verseTight,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export interface DesignerRender {
  verse: VerseRenderData
  safeArea: boolean
  bitmap: HTMLCanvasElement | null
  report: (text: string) => void
}
function renderThemeBitmap(
  theme: BroadcastTheme,
  imageCache: Map<string, HTMLImageElement>,
  rendering: DesignerRender
) {
  const offscreen = rendering.bitmap ?? document.createElement("canvas")
  rendering.bitmap = offscreen
  if (offscreen.width !== theme.resolution.width)
    offscreen.width = theme.resolution.width
  if (offscreen.height !== theme.resolution.height)
    offscreen.height = theme.resolution.height
  const ctx = offscreen.getContext("2d")
  if (!ctx) return { bitmap: offscreen, metrics: null }
  ctx.clearRect(0, 0, offscreen.width, offscreen.height)
  const metrics = renderVerse(ctx, theme, rendering.verse, { imageCache })
  rendering.report(
    metrics
      ? `${Math.round(metrics.scaledTheme.verseText.fontSize)}px text${metrics.contentOverflows ? " · Text overflows — reduce size or split content" : ""}`
      : "Could not render this theme"
  )
  if (rendering.safeArea) {
    ctx.save()
    ctx.strokeStyle = "#38bdf8"
    ctx.lineWidth = 2
    ctx.setLineDash([12, 10])
    ctx.strokeRect(
      offscreen.width * 0.05,
      offscreen.height * 0.05,
      offscreen.width * 0.9,
      offscreen.height * 0.9
    )
    ctx.restore()
  }
  return { bitmap: offscreen, metrics }
}
