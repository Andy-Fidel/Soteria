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

const BOLD_CRIMSON: BroadcastTheme = {
  ...BOLD_PROCLAMATION,
  id: "builtin-bold-crimson",
  name: "Bold Crimson",
  background: {
    type: "gradient",
    color: "#160708",
    gradient: {
      type: "linear",
      angle: 145,
      stops: [
        { color: "#160708", position: 0 },
        { color: "#5b1016", position: 58 },
        { color: "#d4a15f", position: 100 },
      ],
    },
    image: null,
  },
  verseText: {
    ...BOLD_PROCLAMATION.verseText,
    color: "#fff8ee",
    shadow: { color: "rgba(0,0,0,0.72)", blur: 18, x: 0, y: 5 },
  },
  verseNumbers: {
    ...BOLD_PROCLAMATION.verseNumbers,
    color: "#f8c978",
  },
  reference: {
    ...BOLD_PROCLAMATION.reference,
    color: "#f8c978",
  },
  divider: {
    ...BOLD_PROCLAMATION.divider,
    color: "#f8c978",
  },
}

const BOLD_COBALT: BroadcastTheme = {
  ...BOLD_PROCLAMATION,
  id: "builtin-bold-cobalt",
  name: "Bold Cobalt",
  background: {
    type: "gradient",
    color: "#06121f",
    gradient: {
      type: "radial",
      angle: 0,
      stops: [
        { color: "#163a66", position: 0 },
        { color: "#06121f", position: 72 },
        { color: "#02050a", position: 100 },
      ],
    },
    image: null,
  },
  verseText: {
    ...BOLD_PROCLAMATION.verseText,
    color: "#f4fbff",
    shadow: { color: "rgba(0,0,0,0.75)", blur: 20, x: 0, y: 5 },
  },
  verseNumbers: {
    ...BOLD_PROCLAMATION.verseNumbers,
    color: "#8fd8ff",
  },
  reference: {
    ...BOLD_PROCLAMATION.reference,
    color: "#8fd8ff",
  },
  divider: {
    ...BOLD_PROCLAMATION.divider,
    color: "#8fd8ff",
  },
  logo: {
    ...BOLD_PROCLAMATION.logo!,
    opacity: 0.9,
  },
}

const BOLD_CHAPEL: BroadcastTheme = {
  ...BOLD_PROCLAMATION,
  id: "builtin-bold-chapel",
  name: "Bold Chapel",
  background: {
    type: "solid",
    color: "#f8f5ef",
    gradient: null,
    image: null,
  },
  verseText: {
    ...BOLD_PROCLAMATION.verseText,
    color: "#171717",
    fontWeight: 700,
    shadow: null,
  },
  verseNumbers: {
    ...BOLD_PROCLAMATION.verseNumbers,
    color: "#8a5a20",
  },
  reference: {
    ...BOLD_PROCLAMATION.reference,
    color: "#8a5a20",
  },
  divider: {
    ...BOLD_PROCLAMATION.divider,
    color: "#8a5a20",
  },
  logo: {
    ...BOLD_PROCLAMATION.logo!,
    url: "/manna-logo.png",
    opacity: 0.9,
  },
}

export const BUILTIN_THEMES: BroadcastTheme[] = [
  BOLD_PROCLAMATION,
  BOLD_CRIMSON,
  BOLD_COBALT,
  BOLD_CHAPEL,
]
