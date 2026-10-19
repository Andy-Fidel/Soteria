import { afterEach, expect, it, vi } from "vitest"
import { ensureDesignerImage } from "./designer-images"
afterEach(() => vi.unstubAllGlobals())
it("redraws every waiting canvas when a shared image finishes loading", async () => {
  let image: { onload: () => void }
  vi.stubGlobal(
    "Image",
    class {
      constructor() {
        image = this as unknown as typeof image
      }
    }
  )
  const cache = new Map<string, HTMLImageElement>()
  const pending = new Map<string, Promise<HTMLImageElement>>()
  const first = vi.fn(),
    second = vi.fn()
  ensureDesignerImage("/background.png", cache, pending)
  ensureDesignerImage("/background.png", cache, pending, first)
  ensureDesignerImage("/background.png", cache, pending, second)
  image!.onload()
  await Promise.all(pending.values())
  expect(first).toHaveBeenCalledOnce()
  expect(second).toHaveBeenCalledOnce()
  expect(cache.has("/background.png")).toBe(true)
  expect(pending.size).toBe(0)
})
