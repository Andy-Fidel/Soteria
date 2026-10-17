import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Button } from "@/components/ui/button"
import { useSettingsStore, persistEnabledHymnals } from "@/stores"
import { HYMNAL_NAMES, HYMNAL_SOURCES } from "@/types"
import type { HymnalSource } from "@/types"

import { canEnableHymnal } from "@/lib/hymnal-availability"

export function HymnalsSection() {
  const enabledHymnals = useSettingsStore((s) => s.enabledHymnals)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const refreshCounts = useCallback(async () => {
    try {
      const rows =
        await invoke<[string, string, number, number][]>("list_hymnal_counts")
      const next: Record<string, number> = {}
      for (const [id, , count] of rows) next[id] = count
      setCounts(next)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void refreshCounts()
  }, [refreshCounts])

  const handleToggle = async (id: HymnalSource, on: boolean) => {
    if (on && !canEnableHymnal(id, counts[id] ?? 0)) return
    const next = on
      ? Array.from(new Set([...enabledHymnals, id]))
      : enabledHymnals.filter((x) => x !== id)
    await persistEnabledHymnals(next)

    if (on && (counts[id] ?? 0) === 0) {
      setBusyId(id)
      try {
        const seededCount = await invoke<number>("seed_hymnal", {
          hymnalId: id,
        })
        const { useSongStore } = await import("@/stores/song-store")
        await useSongStore.getState().hydrateSongs()
        await refreshCounts()
        if (seededCount === 0) {
          const { toast } = await import("sonner")
          toast.warning(
            `${HYMNAL_NAMES[id as HymnalSource] ?? id} hymnal is empty`,
            {
              description: "Seed data is not bundled yet for this hymnal.",
            }
          )
        }
      } catch (e) {
        console.warn(`[hymnals] seed ${id} failed:`, e)
        const { toast } = await import("sonner")
        toast.error(
          `Failed to seed ${HYMNAL_NAMES[id as HymnalSource] ?? id}: ${e}`
        )
      } finally {
        setBusyId(null)
      }
    }
  }

  const handleDeleteAll = async (id: string) => {
    const name = HYMNAL_NAMES[id as HymnalSource] ?? id
    if (!window.confirm(`Delete all ${name} hymns? This cannot be undone.`))
      return
    setBusyId(id)
    try {
      await invoke<number>("delete_hymnal_songs", { hymnalId: id })
      await persistEnabledHymnals(enabledHymnals.filter((x) => x !== id))
      const { useSongStore } = await import("@/stores/song-store")
      await useSongStore.getState().hydrateSongs()
      await refreshCounts()
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Toggle hymnals on or off. Disabled hymnals stay in the database but are
        hidden from the Songs panel. Delete removes the rows entirely.
      </p>
      {HYMNAL_SOURCES.map((id) => {
        const isEnabled = enabledHymnals.includes(id)
        const count = counts[id] ?? 0
        const seeded = count > 0
        const available = canEnableHymnal(id, count)
        return (
          <div
            key={id}
            className="flex items-center gap-3 rounded-md border border-border p-3"
          >
            <input
              type="checkbox"
              checked={isEnabled && available}
              onChange={(e) => handleToggle(id, e.target.checked)}
              disabled={busyId === id || !available}
              className="size-4"
            />
            <div className="flex-1">
              <div className="text-sm font-medium">{HYMNAL_NAMES[id]}</div>
              <div className="text-xs text-muted-foreground">
                {seeded ? `${count.toLocaleString()} hymns` : available ? "Not seeded" : "Not available in this build"}
                {busyId === id ? " · working…" : ""}
              </div>
            </div>
            {seeded && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDeleteAll(id)}
                disabled={busyId === id}
              >
                Delete all
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
