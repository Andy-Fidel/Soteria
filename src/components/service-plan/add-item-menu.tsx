import { useState } from "react"
import { PlusIcon, ListTreeIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useServicePlan } from "@/hooks/use-service-plan"
import { useSessionStore } from "@/stores/session-store"
import type { PlanItem, PlanItemPayload } from "@/types"
import { AddPlanSheet } from "./(modals)/add-plan-sheet"

export function AddItemMenu({ onEdit }: { onEdit: (item: PlanItem) => void }) {
  const { addItem } = useServicePlan()
  const hasSession = useSessionStore((s) => s.activeSession !== null)
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  const add = async (payload: PlanItemPayload) => {
    if (adding || !hasSession) return
    setAdding(true)
    try {
      const item = await addItem(payload.type, payload)
      setOpen(false)
      if (
        item &&
        useSessionStore.getState().activeSession?.id === item.planId &&
        payload.type === "blank" &&
        (payload.textOverlay || payload.prayer)
      )
        onEdit(item)
    } catch (error) {
      toast.error(`Could not add item: ${error}`)
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        title="Add section header"
        aria-label="Add section header"
        disabled={!hasSession || adding}
        onClick={() => void add({ type: "section", label: "New Section" })}
      >
        <ListTreeIcon className="size-3.5" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={!hasSession || adding}
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="size-3.5" />
        Add slide
      </Button>
      <AddPlanSheet
        open={open}
        onOpenChange={setOpen}
        adding={adding}
        onAdd={(payload) => void add(payload)}
      />
    </>
  )
}
