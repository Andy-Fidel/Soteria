// src/components/panels/service-plan-panel.tsx
import { useState } from "react"
import { CalendarDaysIcon, FolderIcon } from "lucide-react"
import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react"
import { useSortable, isSortable } from "@dnd-kit/react/sortable"
import { useServicePlan } from "@/hooks/use-service-plan"
import { useServicePlanStore } from "@/stores/service-plan-store"
import { handlePlanKeyDown } from "@/components/service-plan/(lib)/keyboard"
import { AddItemMenu } from "@/components/service-plan/add-item-menu"
import { ServicePlanItem } from "./service-plan-item"
import { ServicePlanItemEditor } from "./service-plan-item-editor"
import { TemplateManager } from "@/components/service-plan/template-manager"
import { Button } from "@/components/ui/button"
import type { PlanItem } from "@/types"
import { useSessionStore, useTranscriptStore } from "@/stores"
import { getWorkspaceMode, getWorkspaceModeCopy } from "@/lib/workspace-mode"

export function ServicePlanPanel() {
  const { plan, activeItemId, pendingAdvanceDeadline, pendingAdvanceTotalMs, reorderItem } =
    useServicePlan()
  const presentedItemId = useServicePlanStore(s => s.presentedItemId)
  const [editing, setEditing] = useState<PlanItem | null>(null)
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false)
  const activeSession = useSessionStore((s) => s.activeSession)
  const pendingServiceStart = useSessionStore((s) => s.pendingServiceStart)
  const sessionsMode = useSessionStore((s) => s.sessionsMode)
  const isTranscribing = useTranscriptStore((s) => s.isTranscribing)
  const modeCopy = getWorkspaceModeCopy(
    getWorkspaceMode({ activeSession, isTranscribing, pendingServiceStart, sessionsMode })
  )

  const handleDragEnd = (event: Parameters<DragEndEvent>[0]) => {
    if (event.canceled || !plan) return
    const source = event.operation.source
    if (!isSortable(source)) return
    const { initialIndex, index } = source.sortable
    if (initialIndex === index) return
    const dragged = plan.items[initialIndex]
    if (!dragged) return
    // Compute neighbors in the new order
    const reordered = [...plan.items]
    const [removed] = reordered.splice(initialIndex, 1)
    reordered.splice(index, 0, removed)
    const prevId = index > 0 ? reordered[index - 1].id : null
    const nextId = index < reordered.length - 1 ? reordered[index + 1].id : null
    void reorderItem(dragged, prevId, nextId)
  }

  if (!plan) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted-foreground">
        <CalendarDaysIcon className="size-6 opacity-40" />
        <p>{modeCopy.servicePlanEmpty}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" tabIndex={0} aria-label="Service plan" onKeyDown={event => handlePlanKeyDown(event, reorderItem)}>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Service Plan
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setTemplateManagerOpen(true)}
          >
            <FolderIcon className="size-3.5" />
            Templates
          </Button>
          <AddItemMenu onEdit={setEditing} />
        </div>
      </div>

      <DragDropProvider onDragEnd={handleDragEnd}>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-2">
          {plan.items.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              {modeCopy.servicePlanEmpty} Click <span className="font-medium">Add</span> to insert items.
            </div>
          )}
          {plan.items.map((item, idx) => (
            <SortableRow
              key={item.id}
              item={item}
              index={idx}
              isActive={activeItemId === item.id}
              isPresented={presentedItemId === item.id}
              pendingAdvanceDeadline={pendingAdvanceDeadline}
              pendingAdvanceTotalMs={pendingAdvanceTotalMs}
              onEdit={setEditing}
            />
          ))}
        </div>
      </DragDropProvider>

      <ServicePlanItemEditor item={editing} onClose={() => setEditing(null)} />
      <TemplateManager open={templateManagerOpen} onOpenChange={setTemplateManagerOpen} />
    </div>
  )
}

interface SortableRowProps {
  item: PlanItem
  index: number
  isPresented: boolean
  isActive: boolean
  pendingAdvanceDeadline: number | null
  pendingAdvanceTotalMs: number | null
  onEdit: (item: PlanItem) => void
}

function SortableRow({
  item,
  index,
  isActive,
  isPresented,
  pendingAdvanceDeadline,
  pendingAdvanceTotalMs,
  onEdit,
}: SortableRowProps) {
  const { ref, isDragging } = useSortable({ id: item.id, index })
  return (
    <div ref={ref} className={isDragging ? "opacity-50" : ""}>
      <ServicePlanItem
        item={item}
        isActive={isActive}
        isPresented={isPresented}
        pendingAdvanceDeadline={pendingAdvanceDeadline}
        pendingAdvanceTotalMs={pendingAdvanceTotalMs}
        onEdit={onEdit}
      />
    </div>
  )
}
