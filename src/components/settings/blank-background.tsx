import { useState } from "react"
import { invoke, convertFileSrc } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { useSettingsStore, persistBrandConfig } from "@/stores/settings-store"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { resolveBlankBackground } from "@/lib/brand"
import { validateVideo } from "@/lib/looping-video"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

export function BlankBackgroundSettings() {
  const brand = useSettingsStore((s) => s.brand)
  const [status, setStatus] = useState<"idle" | "importing">("idle")
  const [error, setError] = useState("")
  const blank = resolveBlankBackground(brand)
  const save = async (patch: Parameters<typeof persistBrandConfig>[0]) => {
    await persistBrandConfig(patch)
    useBroadcastStore.getState().syncBroadcastOutput()
  }
  const pick = async () => {
    setError("")
    try {
      const path = await open({
        multiple: false,
        directory: false,
        filters: [
          { name: "Videos", extensions: ["mp4", "m4v", "mov", "webm"] },
        ],
      })
      if (typeof path !== "string") return
      setStatus("importing")
      const stored = await invoke<string>("import_blank_video", {
        srcPath: path,
      })
      await validateVideo(convertFileSrc(stored))
      await save({ blankBackground: "video", blankVideoPath: stored })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setStatus("idle")
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="blank-background-mode" className="text-sm font-medium">
        Blank background
      </label>
      <Select
        value={blank.videoUrl ? "video" : "image"}
        disabled={status === "importing"}
        onValueChange={(value) => {
          setError("")
          void save({ blankBackground: value as "video" | "image" })
        }}
      >
        <SelectTrigger id="blank-background-mode">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="video">Looping video</SelectItem>
          <SelectItem value="image">Still image</SelectItem>
        </SelectContent>
      </Select>
      {blank.videoUrl && (
        <>
          <p className="text-xs text-muted-foreground">
            {brand.blankVideoPath
              ? "Using your imported video"
              : "Using Light Refractions"}
            . Videos play silently.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={status === "importing"}
              onClick={() => void pick()}
            >
              {status === "importing" ? "Checking video…" : "Choose video"}
            </Button>
            {brand.blankVideoPath && (
              <Button
                size="sm"
                variant="ghost"
                disabled={status === "importing"}
                onClick={() => {
                  setError("")
                  void save({ blankVideoPath: null })
                }}
              >
                Use bundled video
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            MP4 with H.264 is recommended. Soteria keeps a local copy and checks
            that it can play.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
