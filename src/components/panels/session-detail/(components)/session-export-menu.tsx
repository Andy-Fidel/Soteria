import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DownloadIcon,
  ClipboardIcon,
  FileTextIcon,
  FileJsonIcon,
  PrinterIcon,
  LoaderIcon,
  SparklesIcon,
} from "lucide-react"
import {
  buildSessionExportJson,
  buildSessionExportMarkdown,
  buildSessionExportSlug,
  buildSessionPdfBytes,
} from "@/lib/session-export"
import { saveTextExport, saveBinaryExport } from "../(lib)/save-export"
import type {
  SessionDetection,
  SessionNote,
  SessionTranscriptSegment,
} from "@/types/session"
interface SessionExportMenuProps {
  sessionTitle: string
  sessionId: number
  detections: SessionDetection[]
  notes: SessionNote[]
  transcript: SessionTranscriptSegment[]
  summarizing: boolean
  onSummarize: () => void
}
export function SessionExportMenu({
  sessionTitle,
  sessionId,
  detections,
  notes,
  transcript,
  summarizing,
  onSummarize,
}: SessionExportMenuProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  // Close export dropdown on outside click or Escape.
  useEffect(() => {
    if (!exportOpen) return
    const onPointer = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportOpen(false)
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [exportOpen])

  const handleCopyClipboard = () => {
    const text = buildSessionExportMarkdown(
      sessionTitle,
      detections,
      notes,
      transcript
    )
    navigator.clipboard.writeText(text)
    setExportOpen(false)
  }

  const handleDownloadMarkdown = async () => {
    const md = buildSessionExportMarkdown(
      sessionTitle,
      detections,
      notes,
      transcript
    )
    const slug = buildSessionExportSlug(sessionTitle)
    try {
      await saveTextExport(md, `${slug}.md`, {
        name: "Markdown",
        extensions: ["md"],
      })
      setExportOpen(false)
    } catch (e) {
      console.error("[session] markdown export failed:", e)
    }
  }

  const handleDownloadJson = async () => {
    const data = buildSessionExportJson(
      sessionTitle,
      sessionId,
      detections,
      notes,
      transcript
    )
    const slug = buildSessionExportSlug(sessionTitle)
    try {
      await saveTextExport(JSON.stringify(data, null, 2), `${slug}.json`, {
        name: "JSON",
        extensions: ["json"],
      })
      setExportOpen(false)
    } catch (e) {
      console.error("[session] JSON export failed:", e)
    }
  }

  const handlePrint = async () => {
    const bytes = buildSessionPdfBytes(
      sessionTitle,
      detections,
      notes,
      transcript
    )
    const slug = buildSessionExportSlug(sessionTitle)
    try {
      await saveBinaryExport(bytes, `${slug}.pdf`, {
        name: "PDF",
        extensions: ["pdf"],
      })
      setExportOpen(false)
    } catch (e) {
      console.error("[session] PDF export failed:", e)
    }
  }

  const handleSummarize = () => {
    setExportOpen(false)
    onSummarize()
  }
  return (
    <div className="relative" ref={exportRef}>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => setExportOpen((v) => !v)}
        title="Export"
      >
        <DownloadIcon className="size-3.5" />
      </Button>
      {exportOpen && (
        <div className="absolute top-full right-0 z-50 mt-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-lg">
          <button
            onClick={handleCopyClipboard}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted/50"
          >
            <ClipboardIcon className="size-3.5" />
            Copy to Clipboard
          </button>
          <button
            onClick={handleDownloadMarkdown}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted/50"
          >
            <FileTextIcon className="size-3.5" />
            Download Markdown
          </button>
          <button
            onClick={handleDownloadJson}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted/50"
          >
            <FileJsonIcon className="size-3.5" />
            Download JSON
          </button>
          <button
            onClick={handlePrint}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted/50"
          >
            <PrinterIcon className="size-3.5" />
            Print / PDF
          </button>
          <div className="my-1 border-t border-border" />
          <button
            onClick={handleSummarize}
            disabled={summarizing || transcript.length === 0}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {summarizing ? (
              <LoaderIcon className="size-3.5 animate-spin" />
            ) : (
              <SparklesIcon className="size-3.5" />
            )}
            Summarize with AI
          </button>
        </div>
      )}
    </div>
  )
}
