const DIVINE_NAMES: Record<string, string> = {
  god: "God",
  jesus: "Jesus",
  christ: "Christ",
  jehovah: "Jehovah",
  yahweh: "Yahweh",
  lord: "Lord",
  saviour: "Saviour",
  savior: "Savior",
  redeemer: "Redeemer",
  holy: "Holy",
  spirit: "Spirit",
  ghost: "Ghost",
}

const DIVINE_NAME = /(?<![\p{L}\p{N}_])(?:holy[^\S\r\n]+(?:spirit|ghost)|god|jesus|christ|jehovah|yahweh|lord|saviour|savior|redeemer)(?![\p{L}\p{N}_])/giu

/** Display only: retain the source lyrics and intentional all-capital words. */
export function capitalizeSongLyrics(text: string): string {
  return text.replace(DIVINE_NAME, (name) =>
    name.replace(/\S+/g, (word) =>
      word === word.toUpperCase() ? word : DIVINE_NAMES[word.toLowerCase()]
    )
  )
}
