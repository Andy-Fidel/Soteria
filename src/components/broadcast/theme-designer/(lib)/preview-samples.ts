import type { VerseRenderData } from "@/types"
export const PREVIEW_SAMPLES: Record<
  string,
  { label: string; verse: VerseRenderData }
> = {
  short: {
    label: "Short scripture",
    verse: {
      reference: "Genesis 1:1 (KJV)",
      segments: [
        {
          verseNumber: 1,
          text: "In the beginning God created the heaven and the earth.",
        },
      ],
    },
  },
  long: {
    label: "Long scripture",
    verse: {
      reference: "John 3:16 (KJV)",
      segments: [
        {
          verseNumber: 16,
          text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
        },
      ],
    },
  },
  passage: {
    label: "Multiple verses",
    verse: {
      reference: "John 3:16–17 (KJV)",
      segments: [
        {
          verseNumber: 16,
          text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
        },
        {
          verseNumber: 17,
          text: "For God sent not his Son into the world to condemn the world; but that the world through him might be saved.",
        },
      ],
    },
  },
  song: {
    label: "Song lyrics",
    verse: {
      reference: "Amazing Grace",
      hideReference: true,
      segments: [
        {
          text: "Amazing grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see",
        },
      ],
    },
  },
}
