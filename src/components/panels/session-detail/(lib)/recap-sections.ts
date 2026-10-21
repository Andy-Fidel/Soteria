export interface RecapSections {
  message: string
  reflection: string
  prayer: string
}

/** Read explicit section labels without interpreting ordinary prose as headings. */
export function splitRecap(recap: string): RecapSections {
  const sections: RecapSections = { message: recap, reflection: "", prayer: "" }
  const headings = [...recap.matchAll(/^(Reflection|Prayer):[ \t]*(?:\r?\n)?/gim)]
  if (!headings.length) return sections
  const withoutSeparator = (text: string) => text.replace(/\r?\n\r?\n$/, "")
  sections.message = withoutSeparator(recap.slice(0, headings[0].index))
  headings.forEach((heading, index) => {
    const next = headings[index + 1]
    const text = recap.slice(heading.index! + heading[0].length, next?.index)
    const key = heading[1].toLowerCase() as "reflection" | "prayer"
    sections[key] = next ? withoutSeparator(text) : text
  })
  return sections
}

export function joinRecap(sections: RecapSections): string {
  return `${sections.message}\n\nReflection:\n${sections.reflection}\n\nPrayer:\n${sections.prayer}`
}
