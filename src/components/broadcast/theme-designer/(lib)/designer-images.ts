import { toast } from "sonner"

// Keep a small decoded-image cache across theme switches and designer visits.
export const designerImages = new Map<string, HTMLImageElement>()
export const designerImageRequests = new Map<
  string,
  Promise<HTMLImageElement>
>()

export function ensureDesignerImage(
  url: string,
  cache: Map<string, HTMLImageElement>,
  pending: Map<string, Promise<HTMLImageElement>>,
  onReady?: () => void
) {
  if (cache.has(url)) return
  let request = pending.get(url)
  if (!request) {
    request = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error("Could not load the theme image."))
      image.src = url
    })
      .then((image) => {
        cache.set(url, image)
        if (cache.size > 12) cache.delete(cache.keys().next().value!)
        return image
      })
      .catch((error) => {
        toast.error("Could not load the theme image.")
        throw error
      })
      .finally(() => pending.delete(url))
    pending.set(url, request)
  }
  // Every caller must subscribe, including callers arriving during a load.
  void request.then(() => onReady?.()).catch(() => {})
}
