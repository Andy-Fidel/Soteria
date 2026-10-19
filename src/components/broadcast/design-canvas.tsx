import { CanvasToolbar } from "./theme-designer/(components)/canvas-toolbar"
import { useThemeCanvas } from "./theme-designer/(hooks)/use-theme-canvas"
export function DesignCanvas() {
  const {
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
    actions: { setSample, setSafeArea, zoomIn, zoomOut, autoZoom, toggleGrid },
  } = useThemeCanvas()
  const elementLabel =
    selectedElement === "verse"
      ? "verse"
      : selectedElement === "reference"
        ? "reference"
        : "none"

  return (
    <div className="dark flex h-full flex-col overflow-hidden">
      <CanvasToolbar
        sample={sample}
        onSample={setSample}
        zoom={zoomLevel}
        zoomIn={zoomIn}
        zoomOut={zoomOut}
        fit={autoZoom}
        grid={gridVisible}
        onGrid={toggleGrid}
        safeArea={safeArea}
        onSafeArea={() => setSafeArea((value) => !value)}
        selected={selectedElement}
      />

      {/* Canvas container */}
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasElRef} />
        {!draftTheme && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "#18181b" }}
          >
            <p className="text-xs text-muted-foreground">
              Select a theme to begin editing
            </p>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div
        className="flex min-h-8 shrink-0 flex-wrap items-center border-t border-border/40 px-3 text-[0.5625rem] text-muted-foreground/70"
        style={{ background: "#18181b" }}
      >
        <span>
          Output: {width} × {height}px
        </span>
        <span className="mx-2">·</span>
        <span>Zoom: {zoomLevel}%</span>
        <span className="mx-2">·</span>
        <span>Scroll to pan; Ctrl/pinch to zoom</span>
        <span className="ml-2" role="status">
          {previewInfo}
        </span>
        <span className="mx-2">·</span>
        <span>
          {selectedElement ? (
            <>
              Editing:{" "}
              <span className="font-medium text-primary">{elementLabel}</span>
            </>
          ) : (
            "Click frame to select"
          )}
        </span>
      </div>
    </div>
  )
}
