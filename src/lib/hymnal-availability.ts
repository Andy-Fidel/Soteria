import { HYMNAL_SOURCES, type HymnalSource } from "@/types"

// Counts from the bundled JSON. The companion test checks every bundle so this
// small manifest stays accurate without shipping the hymn texts to the web UI.
export const BUNDLED_HYMN_COUNTS: Record<HymnalSource, number> = {
  ghs: 260,
  mhb: 0,
  sankey: 0,
  sda: 695,
}

export const AVAILABLE_HYMNALS = HYMNAL_SOURCES.filter((id) => BUNDLED_HYMN_COUNTS[id] > 0)

export function canEnableHymnal(id: HymnalSource, installedCount: number): boolean {
  return BUNDLED_HYMN_COUNTS[id] > 0 || installedCount > 0
}
