import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"
import {
  expandSessionSlides,
  type GallerySlide,
  type SavedSessionSlide,
} from "../(lib)/session-slides"
import { sessionSlidesWithTitle } from "../(lib)/transcript-presentation"
import { downloadSessionSlide } from "../(lib)/slide-download"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type GalleryState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; slides: GallerySlide[] }

export function SlidesTab({
  sessionId,
  title,
  speaker,
}: {
  sessionId: number
  title: string
  speaker: string | null
}) {
  const [state, setState] = useState<GalleryState>({ status: "loading" })
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<GallerySlide | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    invoke<SavedSessionSlide[]>("get_session_slides", { sessionId })
      .then((rows) => {
        if (!cancelled)
          setState({ status: "ready", slides: expandSessionSlides(rows) })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", message: String(error) })
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, retry])

  const slides =
    state.status === "ready"
      ? sessionSlidesWithTitle(state.slides, sessionId, title, speaker)
      : []

  const download = async (slide: GallerySlide) => {
    if (downloading) return
    setDownloading(slide.key)
    try {
      const saved = await downloadSessionSlide(
        slide.image,
        slide.title,
        slide.key
      )
      if (saved) toast.success("Slide downloaded.")
    } catch (error) {
      toast.error(
        `Could not download slide: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      setDownloading(null)
    }
  }
  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-sm font-semibold">Saved slides</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A title slide is created automatically from the session name when no
          saved title slide exists. Download images at 1920 × 1080.
        </p>
      </div>
      {state.status === "loading" && (
        <p role="status" className="text-xs text-muted-foreground">
          Loading slides…
        </p>
      )}
      {state.status === "error" && (
        <div role="alert" className="space-y-2 text-xs">
          <p>Could not load saved slides: {state.message}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setState({ status: "loading" })
              setRetry((n) => n + 1)
            }}
          >
            Try again
          </Button>
        </div>
      )}
      {state.status === "ready" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {slides.map((slide) => (
            <article
              key={slide.key}
              className="min-w-0 overflow-hidden rounded-lg border"
            >
              <button
                className="block w-full bg-black text-left focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => setSelected(slide)}
                aria-label={`View ${slide.title}`}
              >
                <SlidePreview slide={slide} />
              </button>
              <div className="space-y-2 p-3">
                <h3
                  className="truncate text-xs font-medium"
                  title={slide.title}
                >
                  {slide.title}
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={downloading !== null}
                  onClick={() => void download(slide)}
                >
                  <DownloadIcon className="size-3.5" />
                  {downloading === slide.key ? "Downloading…" : "Download PNG"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            <DialogDescription>Saved session slide</DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <SlidePreview slide={selected} />
              <Button
                disabled={downloading !== null}
                onClick={() => void download(selected)}
              >
                <DownloadIcon className="size-3.5" />
                Download PNG
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
function SlidePreview({ slide }: { slide: GallerySlide }) {
  return (
    <div
      role="img"
      aria-label={slide.title}
      className="aspect-video overflow-hidden bg-black"
    >
      <CanvasVerse
        theme={BUILTIN_THEMES[0]}
        verse={null}
        fullscreenImage={slide.image}
      />
    </div>
  )
}
