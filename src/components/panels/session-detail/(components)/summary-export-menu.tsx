import { useState } from "react"
import {
  ClipboardIcon,
  DownloadIcon,
  FileTextIcon,
  PrinterIcon,
  LoaderIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { SermonSummary } from "@/lib/summarize"
import {
  exportSummary,
  type SummaryExportFormat,
} from "../(lib)/summary-export"

export function SummaryExportMenu({
  summary,
  speaker,
}: {
  summary: SermonSummary
  speaker?: string | null
}) {
  const [pending, setPending] = useState<SummaryExportFormat | null>(null)

  async function handleExport(format: SummaryExportFormat) {
    if (pending) return
    setPending(format)
    try {
      const completed = await exportSummary(format, summary, speaker)
      if (completed && format !== "print")
        toast.success(
          format === "clipboard"
            ? "Summary copied to clipboard"
            : "Summary saved as Markdown"
        )
    } catch (error) {
      toast.error(
        `Could not export summary: ${error instanceof Error ? error.message : String(error)}`
      )
    } finally {
      setPending(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending !== null}
        >
          {pending ? (
            <LoaderIcon
              aria-hidden="true"
              className="size-3 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <DownloadIcon aria-hidden="true" className="size-3" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-44 motion-reduce:animate-none"
      >
        <DropdownMenuItem onSelect={() => void handleExport("clipboard")}>
          <ClipboardIcon aria-hidden="true" />
          To clipboard
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void handleExport("markdown")}>
          <FileTextIcon aria-hidden="true" />
          Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void handleExport("print")}>
          <PrinterIcon aria-hidden="true" />
          Print / PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
