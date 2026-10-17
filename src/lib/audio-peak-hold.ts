/** Decay the held audio peak by 30 dB per second, down to the current level. */
export function decayPeakHold(heldDb: number, peakDb: number, elapsedSeconds: number): number {
  return Math.max(-60, peakDb, heldDb - Math.max(0, elapsedSeconds) * 30)
}
