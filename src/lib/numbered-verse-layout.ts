import type { BroadcastTheme, VerseRenderData } from "@/types/broadcast"

export interface VerseWord {
  text: string
  number: boolean
  start?: number
  end?: number
  segmentIndex: number
}
export interface VerseWordLine {
  words: VerseWord[]
  width: number
}

export function numberedWordFont(theme: BroadcastTheme, number: boolean) {
  const vt = theme.verseText
  return `${vt.fontWeight} ${number ? theme.verseNumbers.fontSize : vt.fontSize}px "${vt.fontFamily}", serif`
}

export function measureVerseWords(
  ctx: CanvasRenderingContext2D,
  theme: BroadcastTheme,
  words: VerseWord[],
  trailingSpace = false
) {
  let width = 0
  let text = ""
  let number = words[0]?.number ?? false
  const flush = () => {
    ctx.font = numberedWordFont(theme, number)
    ctx.letterSpacing = `${theme.verseText.letterSpacing}px`
    width += ctx.measureText(text).width
    text = ""
  }
  words.forEach((word, index) => {
    if (word.number !== number) {
      flush()
      number = word.number
    }
    text += word.text + (index < words.length - 1 || trailingSpace ? " " : "")
  })
  flush()
  return width
}

/** One styled layout for drawing, wrapping, auto-fit, and highlight hit boxes. */
export function numberedVerseLines(
  ctx: CanvasRenderingContext2D,
  theme: BroadcastTheme,
  verse: VerseRenderData,
  maxWidth: number
): VerseWordLine[] {
  const lines: VerseWordLine[] = []
  let words: VerseWord[] = []
  const transform = (text: string) =>
    theme.verseText.textTransform === "uppercase"
      ? text.toUpperCase()
      : theme.verseText.textTransform === "lowercase"
        ? text.toLowerCase()
        : theme.verseText.textTransform === "capitalize"
          ? text.replace(/\b\w/g, (c) => c.toUpperCase())
          : text
  const finish = () => {
    lines.push({ words, width: measureVerseWords(ctx, theme, words) })
    words = []
  }
  const add = (word: VerseWord) => {
    const candidate = [...words, word]
    if (
      words.length &&
      (measureVerseWords(ctx, theme, candidate) > maxWidth ||
        (theme.verseText.lineBreakMode === "centered-lines" &&
          words.length >= 6))
    )
      finish()
    words.push(word)
    if (
      theme.verseText.lineBreakMode === "centered-lines" &&
      /[,;:.!?]$/.test(word.text)
    )
      finish()
  }
  ctx.save()
  verse.segments.forEach((segment, segmentIndex) => {
    if (theme.verseNumbers.visible && segment.verseNumber !== undefined)
      add({ text: String(segment.verseNumber), number: true, segmentIndex })
    let offset = 0
    segment.text.split("\n").forEach((paragraph, index, paragraphs) => {
      for (const match of paragraph.matchAll(/\S+/g))
        add({
          text: transform(match[0]),
          number: false,
          segmentIndex,
          start: offset + match.index,
          end: offset + match.index + match[0].length,
        })
      offset += paragraph.length + 1
      if (index < paragraphs.length - 1) finish()
    })
  })
  if (words.length || !lines.length) finish()
  ctx.restore()
  return lines
}
