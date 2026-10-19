import { useRef, useState } from "react"
import { toast } from "sonner"
import { PlusIcon, DownloadIcon, UploadIcon } from "lucide-react"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ThemeCard } from "./theme-designer/(components)/theme-card"
import {
  decodeThemeBackup,
  exportThemeBackup,
} from "./theme-designer/(lib)/theme-transfer"
import type { BroadcastTheme } from "@/types"

export function ThemeLibrary({
  onEdit,
  onDuplicate,
}: {
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
}) {
  const themes = useBroadcastStore((s) => s.themes)
  const active = useBroadcastStore((s) => s.activeThemeId)
  const editing = useBroadcastStore((s) => s.editingThemeId)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const filtered = themes.filter(
    (t) =>
      t.name.toLowerCase().includes(search.trim().toLowerCase()) &&
      (filter !== "pinned" || t.pinned) &&
      (filter !== "custom" || !t.builtin)
  )
  const perform = async (work: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await work()
    } catch (error) {
      toast.error(String(error instanceof Error ? error.message : error))
    } finally {
      setBusy(false)
    }
  }
  const rename = async (theme: BroadcastTheme) => {
    const name = window.prompt("Theme name", theme.name)?.trim()
    if (!name || name === theme.name) return
    await useBroadcastStore
      .getState()
      .saveTheme({ ...theme, name, updatedAt: Date.now() })
    const state = useBroadcastStore.getState()
    if (state.draftTheme?.id === theme.id) state.updateDraft({ name })
  }
  const importFile = async (file?: File) => {
    if (!file) return
    if (file.size > 64 * 1024 * 1024)
      throw new Error("Theme backup must be smaller than 64 MB.")
    const imported = decodeThemeBackup(await file.text())
    let count = 0
    try {
      for (const theme of imported) {
        await useBroadcastStore.getState().saveTheme(theme)
        count++
      }
      toast.success(`Imported ${count} theme${count === 1 ? "" : "s"}.`)
    } catch (error) {
      throw new Error(
        `Imported ${count} of ${imported.length} themes. ${String(error)}`
      )
    }
  }
  return (
    <fieldset
      disabled={busy}
      className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border bg-card"
    >
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        <span className="text-lg font-semibold">Themes</span>
        <Button
          onClick={() =>
            onDuplicate(
              editing && themes.some((t) => t.id === editing) ? editing : active
            )
          }
        >
          <PlusIcon className="size-4" />
          New
        </Button>
      </div>
      <div className="p-3">
        <Input
          aria-label="Search themes"
          placeholder="Search themes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Tabs value={filter} onValueChange={setFilter} className="px-3 pb-3">
        <TabsList className="w-full">
          {["all", "pinned", "custom"].map((value) => (
            <TabsTrigger key={value} value={value} className="capitalize">
              {value}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="flex gap-2 px-3 pb-3">
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Import theme backup"
          onChange={(e) => {
            void perform(() => importFile(e.target.files?.[0]))
            e.target.value = ""
          }}
        />
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => fileInput.current?.click()}
        >
          <UploadIcon className="size-3" />
          Import
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() =>
            void perform(async () => {
              if (await exportThemeBackup(themes))
                toast.success("Theme backup saved.")
            })
          }
        >
          <DownloadIcon className="size-3" />
          Export All
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 px-2 pb-4">
          {filtered.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              active={theme.id === active}
              editing={theme.id === editing}
              onSelect={() => onEdit(theme.id)}
              onDuplicate={() => onDuplicate(theme.id)}
              onPin={() =>
                void perform(async () => {
                  await useBroadcastStore
                    .getState()
                    .saveTheme({ ...theme, pinned: !theme.pinned })
                  const state = useBroadcastStore.getState()
                  if (state.draftTheme?.id === theme.id)
                    state.updateDraft({ pinned: !theme.pinned })
                })
              }
              onRename={() => void perform(() => rename(theme))}
              onDelete={() => {
                if (
                  window.confirm(
                    `Delete “${theme.name}”? This also discards unsaved edits to this theme.`
                  )
                )
                  void perform(() =>
                    useBroadcastStore.getState().deleteTheme(theme.id)
                  )
              }}
            />
          ))}
          {!filtered.length && (
            <p className="p-4 text-center text-xs text-muted-foreground">
              No themes found
            </p>
          )}
        </div>
      </ScrollArea>
    </fieldset>
  )
}
