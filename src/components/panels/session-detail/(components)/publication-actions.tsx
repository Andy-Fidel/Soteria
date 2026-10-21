import { useState } from "react"
import { openUrl } from "@tauri-apps/plugin-opener"
import { GlobeIcon, LoaderIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { SessionPublication } from "../(lib)/publication"

export function PublicationActions({
  publication,
  disabled,
  publishing,
  onPublish,
}: {
  publication: SessionPublication | null
  disabled: boolean
  publishing: boolean
  onPublish: () => void
}) {
  const [status, setStatus] = useState("")
  const url = publication?.url
  return (
    <div className="space-y-2 pt-2">
      <Button size="sm" disabled={disabled} onClick={onPublish}>
        {publishing ? (
          <LoaderIcon className="size-3.5 animate-spin" />
        ) : (
          <GlobeIcon className="size-3.5" />
        )}
        {publishing
          ? "Publishing…"
          : url
            ? "Update published recap"
            : "Publish recap"}
      </Button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Publishes this recap and its title artwork to sermon.ewcadentan.com.
      </p>
      {url && (
        <div className="space-y-2 rounded-md bg-primary/5 p-3">
          <p className="text-xs font-medium text-primary">Published recap</p>
          <p className="text-xs break-all text-muted-foreground">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void openUrl(url).catch(() =>
                  setStatus(
                    "Could not open the page. Copy its link to your browser."
                  )
                )
              }
            >
              Open page
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                void navigator.clipboard.writeText(url).then(
                  () => setStatus("Link copied"),
                  () => setStatus("Could not copy the link.")
                )
              }
            >
              Copy link
            </Button>
          </div>
        </div>
      )}
      {status && (
        <p role="status" className="text-xs text-muted-foreground">
          {status}
        </p>
      )}
    </div>
  )
}
