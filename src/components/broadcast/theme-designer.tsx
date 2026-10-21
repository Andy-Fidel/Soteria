import { useEffect, useState } from "react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { toast } from "sonner"
import { ArrowLeftIcon, SaveIcon, Undo2Icon, Redo2Icon } from "lucide-react"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { themeHasChanges } from "@/lib/broadcast-theme"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ThemeLibrary } from "./theme-library"
import { DesignCanvas } from "./design-canvas"
import { PropertiesPanel } from "./properties-panel"
import { UnsavedThemeDialog } from "./theme-designer/(components)/unsaved-theme-dialog"

export function ThemeDesigner() {
  const open = useBroadcastStore((s) => s.isDesignerOpen)
  const draft = useBroadcastStore((s) => s.draftTheme)
  const themes = useBroadcastStore((s) => s.themes)
  const busy = useBroadcastStore((s) => s.themeSaveStatus) === "saving"
  const past = useBroadcastStore((s) => s.draftPast)
  const future = useBroadcastStore((s) => s.draftFuture)
  const [pending, setPending] = useState<{ run: () => void } | null>(null)
  const dirty = themeHasChanges(
    draft,
    themes.find((t) => t.id === draft?.id)
  )
  const request = (run: () => void) => {
    if (busy) return
    if (dirty) setPending({ run })
    else run()
  }
  const save = async () => {
    try {
      const saved = await useBroadcastStore.getState().saveDraft()
      if (saved) toast.success("Theme saved.")
      return saved
    } catch (error) {
      toast.error(
        `Could not save theme: ${error instanceof Error ? error.message : String(error)}`
      )
      return null
    }
  }
  const apply = async (output: "main" | "alt") => {
    const saved = dirty ? await save() : draft
    if (!saved) return
    const state = useBroadcastStore.getState()
    if (output === "main") state.setActiveTheme(saved.id)
    else state.setAltActiveTheme(saved.id)
    toast.success(
      `Theme applied to ${output === "main" ? "Main" : "Alternate"}.`
    )
  }
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return
      const target = e.target as HTMLElement | null
      if (target?.closest("input,textarea,[contenteditable=true]")) return
      e.preventDefault()
      if (e.shiftKey) useBroadcastStore.getState().redoDraft()
      else useBroadcastStore.getState().undoDraft()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open])
  return (
    <>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(value) => {
          if (!value)
            request(() => useBroadcastStore.getState().setDesignerOpen(false))
          else useBroadcastStore.getState().setDesignerOpen(true)
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background text-foreground outline-none"
            aria-describedby="theme-designer-help"
          >
            <DialogPrimitive.Title className="sr-only">
              Theme Designer
            </DialogPrimitive.Title>
            <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close theme designer"
                disabled={busy}
                onClick={() =>
                  request(() =>
                    useBroadcastStore.getState().setDesignerOpen(false)
                  )
                }
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
              <Input
                className="w-52"
                aria-label="Theme name"
                maxLength={110}
                value={draft?.name ?? ""}
                disabled={busy || !draft}
                onChange={(e) =>
                  useBroadcastStore
                    .getState()
                    .updateDraft({ name: e.target.value })
                }
              />
              <span className="text-xs text-muted-foreground" role="status">
                {busy ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
              </span>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Undo theme change"
                disabled={busy || !past.length}
                onClick={() => useBroadcastStore.getState().undoDraft()}
              >
                <Undo2Icon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Redo theme change"
                disabled={busy || !future.length}
                onClick={() => useBroadcastStore.getState().redoDraft()}
              >
                <Redo2Icon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                disabled={busy || !dirty}
                onClick={() =>
                  request(() => useBroadcastStore.getState().discardDraft())
                }
              >
                Revert
              </Button>
              <Button disabled={busy || !dirty} onClick={() => void save()}>
                <SaveIcon className="size-4" />
                {draft?.builtin ? "Save a copy" : "Save changes"}
              </Button>
              <Button
                variant="outline"
                disabled={busy || !draft}
                onClick={() => void apply("main")}
              >
                {dirty ? "Save & use on Main" : "Use on Main"}
              </Button>
              <Button
                variant="outline"
                disabled={busy || !draft}
                onClick={() => void apply("alt")}
              >
                {dirty ? "Save & use on Alternate" : "Use on Alternate"}
              </Button>
            </div>
            <p
              id="theme-designer-help"
              className="shrink-0 border-b px-4 py-1 text-[11px] text-muted-foreground"
            >
              {draft?.builtin
                ? "Built-in themes are protected. Saving creates a custom copy. Choose Use on Main or Alternate to show it."
                : "Save changes updates this theme. If it is in use, that output updates too. Use on Main or Alternate selects the output."}
            </p>
            <fieldset
              disabled={busy}
              className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_290px] xl:grid-cols-[260px_minmax(0,1fr)_320px]"
            >
              <ThemeLibrary
                onEdit={(id) =>
                  request(() => useBroadcastStore.getState().startEditing(id))
                }
                onDuplicate={(id) =>
                  request(() => useBroadcastStore.getState().duplicateTheme(id))
                }
              />
              <DesignCanvas
                key={`${draft?.id}-${draft?.resolution.width}-${draft?.resolution.height}`}
              />
              <PropertiesPanel />
            </fieldset>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <UnsavedThemeDialog
        open={Boolean(pending)}
        busy={busy}
        onCancel={() => setPending(null)}
        onDiscard={() => {
          pending?.run()
          setPending(null)
        }}
        onSave={() =>
          void (async () => {
            if (await save()) {
              pending?.run()
              setPending(null)
            }
          })()
        }
      />
    </>
  )
}
