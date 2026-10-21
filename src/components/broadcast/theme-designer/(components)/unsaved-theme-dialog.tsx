import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
export function UnsavedThemeDialog({
  open,
  busy,
  onCancel,
  onDiscard,
  onSave,
}: {
  open: boolean
  busy: boolean
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save theme changes?</DialogTitle>
          <DialogDescription>
            Your theme has unsaved changes. Save them before continuing, or
            discard them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onDiscard}>
            Discard changes
          </Button>
          <Button disabled={busy} onClick={onSave}>
            {busy ? "Saving…" : "Save and continue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
