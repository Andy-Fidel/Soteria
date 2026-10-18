/** Capture ~1s from default mic, return pass/warn based on peak RMS. */
export const probeAudioLevel = async (): Promise<{
  status: "pass" | "warning"
  detail: string
}> => {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      status: "warning",
      detail: "Audio API unavailable in this environment",
    }
  }
  let stream: MediaStream | null = null
  let ctx: AudioContext | null = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    ctx = new AudioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    const buf = new Float32Array(analyser.fftSize)

    const start = performance.now()
    let peakRms = 0
    while (performance.now() - start < 1000) {
      analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      const rms = Math.sqrt(sum / buf.length)
      if (rms > peakRms) peakRms = rms
      await new Promise((r) => setTimeout(r, 50))
    }

    const db = peakRms > 0 ? 20 * Math.log10(peakRms) : -Infinity
    const dbStr = isFinite(db) ? `${db.toFixed(1)} dBFS` : "silent"
    if (peakRms < 0.005) {
      return {
        status: "warning",
        detail: `No signal detected (peak ${dbStr}). Check mic/console.`,
      }
    }
    if (peakRms < 0.02) {
      return {
        status: "warning",
        detail: `Low signal (peak ${dbStr}). Raise input gain.`,
      }
    }
    return { status: "pass", detail: `Live signal detected (peak ${dbStr}).` }
  } catch (e) {
    return {
      status: "warning",
      detail: `Mic permission denied or unavailable (${e})`,
    }
  } finally {
    stream?.getTracks().forEach((t) => t.stop())
    await ctx?.close().catch(() => {})
  }
}
