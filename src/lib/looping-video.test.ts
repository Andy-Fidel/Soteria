import { beforeEach, expect, it, vi } from "vitest"
import { startLoopingVideo, drawVideoCover } from "./looping-video"

class FakeVideo extends EventTarget {
  muted = false
  loop = false
  playsInline = false
  preload = ""
  src = ""
  readyState = 2
  videoWidth = 1920
  videoHeight = 1080
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  load = vi.fn()
  removeAttribute = vi.fn()
  frame: FrameRequestCallback | null = null
  requestVideoFrameCallback = vi.fn((callback: FrameRequestCallback) => {
    this.frame = callback
    return 9
  })
  cancelVideoFrameCallback = vi.fn()
}
let video: FakeVideo
let fallbackTick: FrameRequestCallback | undefined
beforeEach(() => {
  video = new FakeVideo()
  fallbackTick = undefined
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    fallbackTick = fn
    return 12
  })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  vi.stubGlobal("document", { createElement: () => video })
})

it("plays silently, loops, and repaints on decoded frames without a React render", async () => {
  const paint = vi.fn()
  const loop = startLoopingVideo("/backgrounds/test.mp4", paint)
  await Promise.resolve()
  expect(video).toMatchObject({
    muted: true,
    loop: true,
    playsInline: true,
    src: "/backgrounds/test.mp4",
  })
  expect(video.play).toHaveBeenCalledOnce()
  video.frame?.(0)
  expect(paint).toHaveBeenCalled()
  loop.stop()
})

it("stops and releases its decoder and callbacks when blank is replaced", () => {
  const paint = vi.fn()
  const loop = startLoopingVideo("test.mp4", paint)
  loop.stop()
  paint.mockClear()
  video.frame?.(100)
  expect(paint).not.toHaveBeenCalled()
  expect(video.pause).toHaveBeenCalledOnce()
  expect(video.removeAttribute).toHaveBeenCalledWith("src")
  expect(video.cancelVideoFrameCallback).toHaveBeenCalled()
})

it("reports a failed video once so the caller can keep the still-image fallback", async () => {
  const failed = vi.fn()
  const loop = startLoopingVideo("bad.mp4", vi.fn(), failed)
  video.dispatchEvent(new Event("error"))
  video.dispatchEvent(new Event("error"))
  await Promise.resolve()
  expect(failed).toHaveBeenCalledOnce()
  loop.stop()
})

it("draws a ready frame with cover cropping and skips unavailable frames", () => {
  const drawImage = vi.fn()
  const ctx = { drawImage } as unknown as CanvasRenderingContext2D
  expect(
    drawVideoCover(ctx, video as unknown as HTMLVideoElement, 100, 100)
  ).toBe(true)
  expect(drawImage).toHaveBeenCalledWith(
    video,
    expect.closeTo(-38.8889, 3),
    0,
    expect.closeTo(177.7778, 3),
    100
  )
  video.readyState = 0
  expect(
    drawVideoCover(ctx, video as unknown as HTMLVideoElement, 100, 100)
  ).toBe(false)
})

it("uses animation frames only when decoded-frame callbacks are unavailable and cancels them", () => {
  Object.assign(video, { requestVideoFrameCallback: undefined, currentTime: 1 })
  let tick!: FrameRequestCallback
  const cancel = vi.fn()
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    tick = fn
    return 12
  })
  vi.stubGlobal("cancelAnimationFrame", cancel)
  const paint = vi.fn()
  const loop = startLoopingVideo("test.mp4", paint)
  tick(0)
  tick(16)
  expect(paint).toHaveBeenCalledOnce()
  loop.stop()
  expect(cancel).toHaveBeenCalledWith(12)
})

it("does not report a play rejection after the caller has stopped playback", async () => {
  video.play.mockRejectedValueOnce(new Error("aborted"))
  const failed = vi.fn()
  const loop = startLoopingVideo("test.mp4", vi.fn(), failed)
  loop.stop()
  await Promise.resolve()
  expect(failed).not.toHaveBeenCalled()
})

it("releases the validation decoder after a playable file is accepted", async () => {
  const { validateVideo } = await import("./looping-video")
  const checking = validateVideo("valid.mp4")
  const element = video as unknown as HTMLVideoElement
  element.onloadeddata?.call(element, new Event("loadeddata"))
  await expect(checking).resolves.toBeUndefined()
  expect(video.removeAttribute).toHaveBeenCalledWith("src")
})

it("times out an unreadable video and releases its validation decoder", async () => {
  const { validateVideo } = await import("./looping-video")
  vi.useFakeTimers()
  try {
    const checking = expect(validateVideo("unreadable.mp4")).rejects.toThrow(
      "could not load"
    )
    await vi.advanceTimersByTimeAsync(10000)
    await checking
    expect(video.removeAttribute).toHaveBeenCalledWith("src")
  } finally {
    vi.useRealTimers()
  }
})

it("redraws when WebKit exposes decoded-frame callbacks but does not deliver them", () => {
  const paint = vi.fn()
  const loop = startLoopingVideo("test.mp4", paint)
  expect(fallbackTick).toBeTypeOf("function")
  fallbackTick?.(performance.now() + 150)
  expect(paint).toHaveBeenCalledOnce()
  loop.stop()
})
