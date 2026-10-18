/** One silent decoder per visible output; no per-frame React state updates. */
export function startLoopingVideo(
  url: string,
  paint: () => void,
  failed?: () => void
) {
  const video = document.createElement("video")
  video.muted = true
  video.loop = true
  video.playsInline = true
  video.preload = "auto"
  video.crossOrigin = "anonymous"
  let stopped = false
  let decodedFrame = 0
  let animationFrame = 0
  let lastTime = -1
  let lastDecodedAt = performance.now()
  let lastFallbackAt = -Infinity
  const decodedFrames = typeof video.requestVideoFrameCallback === "function"
  const decodedTick = () => {
    if (stopped) return
    lastDecodedAt = performance.now()
    lastTime = video.currentTime
    paint()
    decodedFrame = video.requestVideoFrameCallback(decodedTick)
  }
  const fallbackTick = (now: number) => {
    if (stopped) return
    // WebKit can expose rVFC without delivering it for a canvas-only video.
    if (
      (!decodedFrames || now - lastDecodedAt > 100) &&
      now - lastFallbackAt >= 1000 / 30 &&
      video.currentTime !== lastTime
    ) {
      lastTime = video.currentTime
      lastFallbackAt = now
      paint()
    }
    animationFrame = requestAnimationFrame(fallbackTick)
  }
  const stop = () => {
    if (stopped) return
    stopped = true
    video.removeEventListener("error", onError)
    if (decodedFrames) video.cancelVideoFrameCallback(decodedFrame)
    cancelAnimationFrame(animationFrame)
    video.pause()
    video.removeAttribute("src")
    video.load()
  }
  const onError = () => {
    if (stopped) return
    stop()
    failed?.()
  }
  video.addEventListener("error", onError)
  video.src = url
  if (decodedFrames) decodedFrame = video.requestVideoFrameCallback(decodedTick)
  animationFrame = requestAnimationFrame(fallbackTick)
  void video.play().catch(onError)
  return { video, stop }
}

export function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  width: number,
  height: number
): boolean {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight)
    return false
  const scale = Math.max(width / video.videoWidth, height / video.videoHeight)
  const w = video.videoWidth * scale
  const h = video.videoHeight * scale
  ctx.drawImage(video, (width - w) / 2, (height - h) / 2, w, h)
  return true
}

/** Check actual browser decoding, not just the filename extension. */
export function validateVideo(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    const finish = (error?: string) => {
      clearTimeout(timer)
      video.onloadeddata = null
      video.onerror = null
      video.removeAttribute("src")
      video.load()
      if (error) reject(new Error(error))
      else resolve()
    }
    const timer = setTimeout(
      () => finish("The video could not load. Try an H.264 MP4 file."),
      10_000
    )
    video.muted = true
    video.preload = "auto"
    video.onloadeddata = () =>
      finish(
        video.videoWidth && video.videoHeight
          ? undefined
          : "This file has no playable video."
      )
    video.onerror = () =>
      finish("This video format cannot play here. Try an H.264 MP4 file.")
    video.src = url
    video.load()
  })
}
