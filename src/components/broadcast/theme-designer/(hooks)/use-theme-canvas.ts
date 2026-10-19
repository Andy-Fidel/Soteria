import { useEffect, useRef, useState, useCallback } from "react"
import * as fabric from "fabric"
import { useBroadcastStore } from "@/stores/broadcast-store"
import type { BroadcastTheme } from "@/types"
import { designerImages, designerImageRequests } from "../(lib)/designer-images"
import { PREVIEW_SAMPLES } from "../(lib)/preview-samples"
import {
  syncThemeToCanvas,
  type DesignerRender,
} from "../(lib)/designer-canvas-scene"
export function useThemeCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const latestThemeRef = useRef<BroadcastTheme | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const imageCacheRef = useRef(designerImages)
  const imageRequestsRef = useRef(designerImageRequests)
  const objectsRef = useRef<{
    workspace: fabric.Rect | null
    referenceRegion: fabric.Rect | null
    verseRegion: fabric.Rect | null
  }>({ workspace: null, referenceRegion: null, verseRegion: null })

  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const editingThemeId = useBroadcastStore((s) => s.editingThemeId)
  const selectedElement = useBroadcastStore((s) => s.selectedElement)
  const width = draftTheme?.resolution.width ?? 1920
  const height = draftTheme?.resolution.height ?? 1080
  const [sample, setSample] = useState("short")
  const [safeArea, setSafeArea] = useState(false)
  const [previewInfo, setPreviewInfo] = useState("")
  const renderingRef = useRef<DesignerRender>({
    verse: PREVIEW_SAMPLES.short.verse,
    safeArea: false,
    bitmap: null,
    report: setPreviewInfo,
  })
  const [zoomLevel, setZoomLevel] = useState(0)
  const [gridVisible, setGridVisible] = useState(false)
  const gridLinesRef = useRef<fabric.Line[]>([])

  const resyncLatestTheme = useCallback(function redraw(): void {
    const latestTheme = latestThemeRef.current
    const canvas = fabricRef.current
    if (!latestTheme || !canvas) return
    void syncThemeToCanvas(
      latestTheme,
      objectsRef,
      canvas,
      imageCacheRef.current,
      imageRequestsRef.current,
      renderingRef.current,
      redraw
    )
  }, [])

  // Auto-zoom: fit workspace into container
  const autoZoom = useCallback(() => {
    const canvas = fabricRef.current
    const container = containerRef.current
    const workspace = objectsRef.current.workspace
    if (!canvas || !container || !workspace) return

    const cw = container.offsetWidth
    const ch = container.offsetHeight
    canvas.setDimensions({ width: cw, height: ch })

    // Reset viewport
    const identity: fabric.TMat2D = [1, 0, 0, 1, 0, 0]
    canvas.setViewportTransform(identity)

    // Calculate zoom to fit workspace with padding
    const scale =
      fabric.util.findScaleToFit(workspace, { width: cw, height: ch }) * 0.85
    canvas.setZoom(scale)

    // Center the workspace
    const wsCenter = workspace.getCenterPoint()
    const vpTransform = canvas.viewportTransform!
    vpTransform[4] = cw / 2 - wsCenter.x * vpTransform[0]
    vpTransform[5] = ch / 2 - wsCenter.y * vpTransform[3]
    canvas.setViewportTransform(vpTransform)
    canvas.requestRenderAll()
    resyncLatestTheme()

    setZoomLevel(Math.round(scale * 100))
  }, [resyncLatestTheme])

  // Initialize Fabric canvas + workspace
  useEffect(() => {
    if (!canvasElRef.current || !containerRef.current || !editingThemeId) return

    gridLinesRef.current = []
    const canvas = new fabric.Canvas(canvasElRef.current, {
      backgroundColor: "#18181b",
      controlsAboveOverlay: true,
    })

    // Set canvas to container size
    const cw = containerRef.current.offsetWidth
    const ch = containerRef.current.offsetHeight
    canvas.setDimensions({ width: cw, height: ch })

    // Create workspace rect (the 1920x1080 "page")
    const workspace = new fabric.Rect({
      width,
      height,
      fill: "white",
      selectable: false,
      hasControls: false,
      hoverCursor: "default",
      shadow: new fabric.Shadow({ color: "rgba(0,0,0,0.4)", blur: 20 }),
      objectCaching: false,
    })
    canvas.add(workspace)
    canvas.centerObject(workspace)
    workspace.setCoords()
    canvas.clipPath = workspace
    objectsRef.current.workspace = workspace

    const refRegion = new fabric.Rect({
      left: 0,
      top: 0,
      originX: "left",
      originY: "top",
      width: 100,
      height: 40,
      fill: "rgba(0,0,0,0.001)",
      stroke: "rgba(245, 158, 11, 0.4)",
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      strokeUniform: true,
      selectable: true,
      hasControls: false,
      hasBorders: true,
      borderColor: "#f59e0b",
      borderDashArray: [6, 3],
      lockMovementX: true,
      lockMovementY: true,
      evented: true,
      objectCaching: false,
      hoverCursor: "pointer",
    })
    canvas.add(refRegion)
    objectsRef.current.referenceRegion = refRegion

    const verseRegion = new fabric.Rect({
      left: 0,
      top: 0,
      originX: "left",
      originY: "top",
      width: 100,
      height: 200,
      fill: "rgba(0,0,0,0.001)",
      stroke: "rgba(245, 158, 11, 0.4)",
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      strokeUniform: true,
      selectable: true,
      hasControls: false,
      hasBorders: true,
      borderColor: "#f59e0b",
      borderDashArray: [6, 3],
      lockMovementX: true,
      lockMovementY: true,
      evented: true,
      objectCaching: false,
      hoverCursor: "pointer",
    })
    canvas.add(verseRegion)
    objectsRef.current.verseRegion = verseRegion

    // Selection events
    canvas.on("selection:created", (e) => {
      const obj = e.selected?.[0]
      if (obj === objectsRef.current.referenceRegion) {
        useBroadcastStore.getState().setSelectedElement("reference")
      } else if (obj === objectsRef.current.verseRegion) {
        useBroadcastStore.getState().setSelectedElement("verse")
      }
    })
    canvas.on("selection:updated", (e) => {
      const obj = e.selected?.[0]
      if (obj === objectsRef.current.referenceRegion) {
        useBroadcastStore.getState().setSelectedElement("reference")
      } else if (obj === objectsRef.current.verseRegion) {
        useBroadcastStore.getState().setSelectedElement("verse")
      }
    })
    canvas.on("selection:cleared", () => {
      useBroadcastStore.getState().setSelectedElement(null)
    })

    canvas.on("mouse:wheel", ({ e }) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.ctrlKey || e.metaKey) {
        const zoom = Math.max(
          0.05,
          Math.min(3, canvas.getZoom() * Math.exp(-e.deltaY * 0.002))
        )
        canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), zoom)
        setZoomLevel(Math.round(zoom * 100))
      } else canvas.relativePan(new fabric.Point(-e.deltaX, -e.deltaY))
      canvas.requestRenderAll()
    })
    fabricRef.current = canvas

    // Auto-zoom after a tick (canvas needs to be in DOM)
    requestAnimationFrame(() => {
      autoZoom()
    })

    // ResizeObserver for auto-zoom on container resize
    const observer = new ResizeObserver(() => autoZoom())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
      void canvas.dispose()
      fabricRef.current = null
      objectsRef.current = {
        workspace: null,
        referenceRegion: null,
        verseRegion: null,
      }
    }
  }, [editingThemeId, autoZoom, width, height])

  // Sync draft theme to the existing Fabric objects (throttled to 1 per frame)
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !draftTheme) return
    latestThemeRef.current = draftTheme
    renderingRef.current.verse = PREVIEW_SAMPLES[sample].verse
    renderingRef.current.safeArea = safeArea

    if (rafIdRef.current) return // already scheduled
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      const latest = latestThemeRef.current
      const latestCanvas = fabricRef.current
      if (!latest || !latestCanvas) return
      void syncThemeToCanvas(
        latest,
        objectsRef,
        latestCanvas,
        imageCacheRef.current,
        imageRequestsRef.current,
        renderingRef.current,
        () => {
          const current = latestThemeRef.current
          const currentCanvas = fabricRef.current
          if (!current || !currentCanvas) return
          void syncThemeToCanvas(
            current,
            objectsRef,
            currentCanvas,
            imageCacheRef.current,
            imageRequestsRef.current,
            renderingRef.current
          )
        }
      )
    })
  }, [draftTheme, sample, safeArea])

  useEffect(() => {
    const refRegion = objectsRef.current.referenceRegion
    const verseRegion = objectsRef.current.verseRegion
    if (!refRegion || !verseRegion) return
    refRegion.set({
      strokeWidth: selectedElement === "reference" ? 2 : 1,
      stroke:
        selectedElement === "reference" ? "#f59e0b" : "rgba(245, 158, 11, 0.4)",
    })
    verseRegion.set({
      strokeWidth: selectedElement === "verse" ? 2 : 1,
      stroke:
        selectedElement === "verse" ? "#f59e0b" : "rgba(245, 158, 11, 0.4)",
    })
    const canvas = fabricRef.current
    const target =
      selectedElement === "verse"
        ? verseRegion
        : selectedElement === "reference"
          ? refRegion
          : null
    if (canvas && target && canvas.getActiveObject() !== target)
      canvas.setActiveObject(target)
    if (canvas && !target && canvas.getActiveObject())
      canvas.discardActiveObject()
    canvas?.requestRenderAll()
  }, [selectedElement])

  const zoomIn = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const newZoom = Math.min(canvas.getZoom() * 1.1, 3)
    canvas.zoomToPoint(
      new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2),
      newZoom
    )
    canvas.requestRenderAll()
    resyncLatestTheme()
    setZoomLevel(Math.round(newZoom * 100))
  }, [resyncLatestTheme])

  const zoomOut = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const newZoom = Math.max(canvas.getZoom() * 0.9, 0.1)
    canvas.zoomToPoint(
      new fabric.Point(canvas.getWidth() / 2, canvas.getHeight() / 2),
      newZoom
    )
    canvas.requestRenderAll()
    resyncLatestTheme()
    setZoomLevel(Math.round(newZoom * 100))
  }, [resyncLatestTheme])

  const toggleGrid = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    if (gridLinesRef.current.length > 0) {
      gridLinesRef.current.forEach((line) => canvas.remove(line))
      gridLinesRef.current = []
      setGridVisible(false)
      canvas.requestRenderAll()
      return
    }
    const ws = objectsRef.current.workspace
    if (!ws) return
    const origin = ws.getPointByOrigin("left", "top")
    const step = 60
    const lines: fabric.Line[] = []
    const opts = {
      stroke: "rgba(255,255,255,0.08)",
      strokeWidth: 1,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    } as const
    for (let x = step; x < width; x += step) {
      lines.push(
        new fabric.Line(
          [origin.x + x, origin.y, origin.x + x, origin.y + height],
          opts
        )
      )
    }
    for (let y = step; y < height; y += step) {
      lines.push(
        new fabric.Line(
          [origin.x, origin.y + y, origin.x + width, origin.y + y],
          opts
        )
      )
    }
    lines.forEach((line) => canvas.add(line))
    gridLinesRef.current = lines
    setGridVisible(true)
    canvas.requestRenderAll()
  }, [width, height])

  useEffect(() => {
    let active = true
    const redraw = () => {
      if (active) resyncLatestTheme()
    }
    void document.fonts.ready.then(redraw)
    document.fonts.addEventListener("loadingdone", redraw)
    return () => {
      active = false
      document.fonts.removeEventListener("loadingdone", redraw)
    }
  }, [resyncLatestTheme])

  return {
    refs: { containerRef, canvasElRef },
    draftTheme,
    view: {
      width,
      height,
      zoomLevel,
      gridVisible,
      selectedElement,
      previewInfo,
      sample,
      safeArea,
    },
    actions: {
      setSample,
      setSafeArea,
      zoomIn,
      zoomOut,
      autoZoom,
      toggleGrid,
    },
  }
}
