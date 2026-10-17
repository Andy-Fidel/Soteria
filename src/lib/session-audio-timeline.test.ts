import { describe, expect, it } from "vitest"
import {
  sessionAudioSeekSeconds,
  type SessionAudioSpan,
} from "./session-audio-timeline"

const spans: SessionAudioSpan[] = [
  {
    wallStartMs: 10_000,
    wallEndMs: 20_000,
    audioStartMs: 0,
    durationMs: 10_000,
  },
  {
    wallStartMs: 40_000,
    wallEndMs: 45_000,
    audioStartMs: 10_080,
    durationMs: 5_000,
  },
  {
    wallStartMs: 90_000,
    wallEndMs: 94_000,
    audioStartMs: 15_160,
    durationMs: 4_000,
  },
]

describe("session audio timeline", () => {
  it("accounts for delayed recording start, pauses, and restarted captures", () => {
    expect(sessionAudioSeekSeconds(12_000, 1_000, spans)).toBe(2)
    expect(sessionAudioSeekSeconds(42_000, 1_000, spans)).toBe(12.08)
    expect(sessionAudioSeekSeconds(92_000, 1_000, spans)).toBe(17.16)
  })

  it("clamps unrecorded time to the next span or the last recorded sample", () => {
    expect(sessionAudioSeekSeconds(5_000, 1_000, spans)).toBe(0)
    expect(sessionAudioSeekSeconds(30_000, 1_000, spans)).toBe(10.08)
    expect(sessionAudioSeekSeconds(120_000, 1_000, spans)).toBe(19.16)
  })

  it("retains legacy fallback and supports a legacy prefix before new recordings", () => {
    expect(sessionAudioSeekSeconds(12_000, 2_000, [])).toBe(10)
    const resumed = [{ ...spans[1], audioStartMs: 10_000 }]
    expect(sessionAudioSeekSeconds(7_000, 2_000, resumed)).toBe(5)
    expect(sessionAudioSeekSeconds(42_000, 2_000, resumed)).toBe(12)
  })

  it("bounds playback and ignores invalid timestamps", () => {
    expect(sessionAudioSeekSeconds(Number.NaN, 1_000, spans)).toBeNull()
    expect(sessionAudioSeekSeconds(12_000, Number.NaN, [])).toBeNull()
    expect(sessionAudioSeekSeconds(92_000, 1_000, spans, 16)).toBe(16)
    expect(sessionAudioSeekSeconds(0, 1_000, [])).toBe(0)
  })
  it("keeps sample offsets correct across repeated dropped 64 ms buffers", () => {
    const droppedBuffers = Array.from({ length: 10 }, (_, index) => ({
      wallStartMs: index * 128,
      wallEndMs: index * 128 + 64,
      audioStartMs: index * 64,
      durationMs: 64,
    }))
    expect(sessionAudioSeekSeconds(640, 0, droppedBuffers)).toBe(0.32)
    expect(sessionAudioSeekSeconds(672, 0, droppedBuffers)).toBe(0.352)
    expect(sessionAudioSeekSeconds(1_184, 0, droppedBuffers)).toBe(0.608)
  })
})
