import type { BroadcastTheme } from "@/types/broadcast"

const baseTheme: Omit<BroadcastTheme, "id" | "name" | "background" | "verseText" | "reference" | "layout" | "transition" | "textBox"> = {
  builtin: true,
  pinned: false,
  createdAt: 0,
  updatedAt: 0,
  resolution: { width: 1920, height: 1080 },
  divider: {
    style: "none" as const,
    color: "#ffffff",
    width: 40,
    opacity: 0.5,
    dotCount: 4,
    dotSize: 4,
  },
  verseNumbers: {
    visible: true,
    fontSize: 14,
    color: "#ffffff",
    superscript: true,
  },
}

const BOLD_PROCLAMATION: BroadcastTheme = {
  ...baseTheme,
  id: "builtin-bold-proclamation",
  name: "Bold Proclamation",
  background: {
    type: "solid",
    color: "#000000",
    gradient: null,
    image: null,
  },
  textBox: {
    enabled: false,
    color: "#000000",
    opacity: 0,
    borderRadius: 0,
    padding: 0,
  },
  verseText: {
    fontFamily: "Inter Variable",
    fontSize: 104,
    fontWeight: 600,
    color: "#ffffff",
    horizontalAlign: "center",
    verticalAlign: "middle",
    textTransform: "none",
    textDecoration: "none",
    lineHeight: 1.4,
    letterSpacing: 0.5,
    shadow: { color: "rgba(0,0,0,0.6)", blur: 16, x: 0, y: 4 },
    outline: null,
    lineBreakMode: "flow" as const,
    autoFit: true,
    minFontSize: 40,
  },
  verseNumbers: {
    visible: false,
    fontSize: 28,
    color: "#fbbf24",
    superscript: true,
  },
  reference: {
    opacity: 0.5,
    fontFamily: "Geist Variable",
    fontSize: 56,
    fontWeight: 700,
    color: "#fbbf24",
    horizontalAlign: "right",
    verticalAlign: "top",
    textTransform: "uppercase",
    textDecoration: "none",
    uppercase: true,
    letterSpacing: 8,
    position: "above",
    standalone: {
      anchor: "bottom-right",
      margin: 60,
    },
  },
  divider: {
    style: "line" as const,
    color: "#fbbf24",
    width: 80,
    opacity: 0.8,
    dotCount: 4,
    dotSize: 4,
  },
  layout: {
    anchor: "center",
    offsetX: 0,
    offsetY: 0,
    padding: { top: 40, right: 60, bottom: 40, left: 60 },
    textAlign: "center",
    backgroundWidth: 100,
    backgroundHeight: 100,
    textAreaWidth: 94,
    textAreaHeight: 96,
    referenceGap: 56,
  },
  logo: {
    url: "/EWC-White.png",
    position: "top-left",
    size: 120,
    opacity: 1,
    margin: 48,
  },
  transition: {
    type: "fade",
    duration: 400,
    easing: "ease-in-out",
    direction: "up",
  },
}

const THE_WORD: BroadcastTheme = {
  ...BOLD_PROCLAMATION,
  id: "builtin-the-word",
  name: "The Word",
  background: {
    type: "image",
    color: "#000000",
    gradient: null,
    image: {
      url: "/backgrounds/the-word.png",
      fit: "cover",
      blur: 0,
      brightness: 70,
      tint: null,
    },
  },
  verseText: {
    ...BOLD_PROCLAMATION.verseText,
    fontSize: 96,
    fontWeight: 700,
    lineHeight: 1.4,
    letterSpacing: 0,
  },
  reference: {
    ...BOLD_PROCLAMATION.reference,
    fontFamily: "Inter Variable",
    fontSize: 44,
    fontWeight: 600,
    color: "#ffffff",
    horizontalAlign: "center",
    letterSpacing: 5,
    position: "below",
    standalone: { anchor: "bottom-center", margin: 96 },
  },
  divider: { ...baseTheme.divider, style: "none" },
  layout: {
    ...BOLD_PROCLAMATION.layout,
    offsetY: -40,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    textAreaWidth: 82,
    textAreaHeight: 80,
  },
  logo: null,
}

const QUIET_LIGHT: BroadcastTheme = {
  ...THE_WORD,
  id: "builtin-quiet-light",
  name: "Quiet Light",
  background: {
    type: "image",
    color: "#000000",
    gradient: null,
    image: {
      url: "/backgrounds/quiet-light.png",
      fit: "cover",
      blur: 0,
      brightness: 100,
      tint: null,
    },
  },
  reference: {
    ...THE_WORD.reference,
    color: "#aab3c2",
  },
}

const NIGHT_SKY: BroadcastTheme = {
  ...THE_WORD,
  id: "builtin-night-sky",
  name: "Night Sky",
  background: {
    type: "image",
    color: "#000000",
    gradient: null,
    image: {
      url: "/backgrounds/night-sky.jpg",
      fit: "cover",
      blur: 0,
      brightness: 60,
      tint: null,
    },
  },
}

const STILL_WATERS: BroadcastTheme = {
  ...THE_WORD,
  id: "builtin-still-waters",
  name: "Still Waters",
  background: {
    type: "image",
    color: "#000000",
    gradient: null,
    image: {
      url: "/backgrounds/still-waters.png",
      fit: "cover",
      blur: 0,
      brightness: 100,
      tint: null,
    },
  },
}

const REFRACTIONS_RUSH: BroadcastTheme = {
  ...THE_WORD,
  id: "builtin-refractions-rush",
  name: "Refractions Rush",
  background: {
    type: "image",
    color: "#000000",
    gradient: null,
    image: {
      url: "/backgrounds/refractions-rush.jpg",
      fit: "cover",
      blur: 0,
      brightness: 40,
      tint: null,
    },
  },
}

export const BUILTIN_THEMES: BroadcastTheme[] = [
  BOLD_PROCLAMATION,
  THE_WORD,
  QUIET_LIGHT,
  NIGHT_SKY,
  STILL_WATERS,
  REFRACTIONS_RUSH,
]
