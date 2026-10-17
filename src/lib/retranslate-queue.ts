import type { QueueItem, Verse } from "@/types"
import { splitVerseIntoChunks, wordCount } from "./verse-splitter"

export interface RetranslateQueueInput {
  items: QueueItem[]
  activeIndex: number | null
  translationId: number
  translatedVerses: Readonly<Record<string, Verse>>
  autoSplitLongVerses: boolean
  splitWordThreshold: number
}

export function scriptureLocationKey(verse: Verse): string {
  return `${verse.book_number}:${verse.chapter}:${verse.verse}`
}

export function retranslateQueueItems(input: RetranslateQueueInput): {
  items: QueueItem[]
  activeIndex: number | null
} {
  const items: QueueItem[] = []
  let activeIndex = input.activeIndex

  for (let oldIndex = 0; oldIndex < input.items.length; ) {
    const first = input.items[oldIndex]
    if (first.kind !== "verse") {
      if (input.activeIndex === oldIndex) activeIndex = items.length
      items.push(first)
      oldIndex += 1
      continue
    }

    const oldGroup = [first]
    if (first.chunk) {
      while (
        oldIndex + oldGroup.length < input.items.length &&
        isSiblingChunk(input.items[oldIndex + oldGroup.length], first)
      ) {
        oldGroup.push(
          input.items[oldIndex + oldGroup.length] as Extract<
            QueueItem,
            { kind: "verse" }
          >
        )
      }
    }

    const translatedVerse =
      input.translatedVerses[scriptureLocationKey(first.verse)]
    const replacement =
      translatedVerse?.translation_id === input.translationId
        ? replacementItems(first, translatedVerse, input)
        : oldGroup

    if (
      input.activeIndex !== null &&
      input.activeIndex >= oldIndex &&
      input.activeIndex < oldIndex + oldGroup.length
    ) {
      const oldPartIndex = input.activeIndex - oldIndex
      const proportionalPart = Math.floor(
        (oldPartIndex / oldGroup.length) * replacement.length
      )
      activeIndex =
        items.length + Math.min(proportionalPart, replacement.length - 1)
    }

    items.push(...replacement)
    oldIndex += oldGroup.length
  }

  return { items, activeIndex }
}

type VerseQueueItem = Extract<QueueItem, { kind: "verse" }>

function isSiblingChunk(item: QueueItem, first: VerseQueueItem): boolean {
  return (
    item.kind === "verse" &&
    item.chunk?.groupId === first.chunk?.groupId &&
    scriptureLocationKey(item.verse) === scriptureLocationKey(first.verse)
  )
}

function replacementItems(
  oldItem: VerseQueueItem,
  verse: Verse,
  input: RetranslateQueueInput
): VerseQueueItem[] {
  const shouldSplit =
    input.autoSplitLongVerses &&
    wordCount(verse.text) > input.splitWordThreshold
  const chunks = shouldSplit ? splitVerseIntoChunks(verse.text) : [verse.text]
  const reference = `${verse.book_name} ${verse.chapter}:${verse.verse}`

  if (chunks.length === 1) {
    return [
      { ...oldItem, verse, reference, chunk: undefined, highlights: undefined },
    ]
  }

  const groupId = oldItem.chunk?.groupId ?? crypto.randomUUID()
  return chunks.map((text, index) => ({
    ...oldItem,
    highlights: undefined,
    id: index === 0 ? oldItem.id : crypto.randomUUID(),
    verse,
    reference: `${reference} (${index + 1}/${chunks.length})`,
    chunk: { groupId, index: index + 1, total: chunks.length, text },
  }))
}
