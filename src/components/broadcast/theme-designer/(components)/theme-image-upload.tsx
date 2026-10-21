import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useBroadcastStore } from "@/stores/broadcast-store"

export function ThemeImageUpload({
  themeId,
  path,
  label,
}: {
  themeId: string
  path: "logo.url" | "background.image.url"
  label: string
}) {
  const version = useRef(0)
  const [busy, setBusy] = useState(false)
  useEffect(
    () => () => {
      version.current++
    },
    []
  )
  const choose = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/png,image/jpeg,image/webp,image/gif"
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (
        !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
          file.type
        ) ||
        file.size > 8 * 1024 * 1024
      ) {
        toast.error("Choose a PNG, JPEG, WebP, or GIF smaller than 8 MB.")
        return
      }
      const current = ++version.current
      setBusy(true)
      const fail = () => {
        if (version.current === current) {
          setBusy(false)
          toast.error("Could not read this image.")
        }
      }
      const reader = new FileReader()
      reader.onerror = fail
      reader.onload = () => {
        const image = new Image()
        image.onerror = fail
        image.onload = () => {
          if (version.current !== current) return
          setBusy(false)
          if (image.naturalWidth * image.naturalHeight > 24_000_000) {
            toast.error("Choose an image with fewer than 24 million pixels.")
            return
          }
          useBroadcastStore
            .getState()
            .updateDraftAsset(themeId, path, String(reader.result))
        }
        image.src = String(reader.result)
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      disabled={busy}
      onClick={choose}
    >
      {busy ? "Reading image…" : label}
    </Button>
  )
}
