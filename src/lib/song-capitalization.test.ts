import { describe, expect, it } from "vitest"
import { capitalizeSongLyrics } from "./song-capitalization"
import { songStanzaToRenderData } from "./song-to-render"
import type { QueueItem, Song } from "@/types"

describe("song capitalization", () => {
  it("capitalizes the agreed names and preserves whitespace", () => {
    expect(
      capitalizeSongLyrics(
        "god jesus christ jehovah yahweh lord saviour savior redeemer\nholy spirit, holy  ghost"
      )
    ).toBe(
      "God Jesus Christ Jehovah Yahweh Lord Saviour Savior Redeemer\nHoly Spirit, Holy  Ghost"
    )
  })

  it("preserves all-capital words, possessives, and unrelated words", () => {
    expect(
      capitalizeSongLyrics(
        "GOD, LORD! god’s christ's; gods godly lordship redeemers father he him spirit ghost"
      )
    ).toBe(
      "GOD, LORD! God’s Christ's; gods godly lordship redeemers father he him spirit ghost"
    )
    expect(capitalizeSongLyrics("HOLY SPIRIT / holy\nghost / égod godé")).toBe(
      "HOLY SPIRIT / holy\nghost / égod godé"
    )
  })

  it("formats existing queued lyrics without changing the queue item or song", () => {
    const song = {
      id: "test",
      stanzas: [{ id: "v1", kind: "verse", lines: ["jesus is lord"] }],
    } as Song
    const item = {
      kind: "song-stanza",
      reference: "Test · Verse 1",
      text: "jesus is lord",
    } as Extract<QueueItem, { kind: "song-stanza" }>
    const before = JSON.stringify({ song, item })
    expect(songStanzaToRenderData(item, song)?.hideReference).toBe(true)
    expect(songStanzaToRenderData(item, song)?.reference).toBe(item.reference)
    expect(songStanzaToRenderData(item, song)?.segments[0].text).toBe(
      "Jesus is Lord"
    )
    expect(JSON.stringify({ song, item })).toBe(before)
  })
})
