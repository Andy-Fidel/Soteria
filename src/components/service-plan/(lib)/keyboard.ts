import { useServicePlanStore } from "@/stores/service-plan-store"
import { activatePlanItem } from "../activation-router"

import type { PlanItem } from "@/types"

type Reorder = (
  item: PlanItem,
  previousId: number | null,
  nextId: number | null
) => Promise<void>

export function handlePlanKeyDown(
  event: React.KeyboardEvent<HTMLDivElement>,
  reorder?: Reorder
) {
  const target = event.target as HTMLElement
  if (
    event.defaultPrevented ||
    !event.currentTarget.contains(target) ||
    target.closest(
      "button, a, input, textarea, select, [contenteditable], [role='combobox'], [role='button']"
    ) ||
    target.ownerDocument.querySelector("[role='dialog'], [role='alertdialog']")
  )
    return
  const store = useServicePlanStore.getState()
  const plan = store.plan
  if (!plan?.items.length) return
  const index = plan.items.findIndex((item) => item.id === store.activeItemId)
  const modifier = event.metaKey || event.ctrlKey
  if (modifier && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
    if (!reorder || index < 0) return
    const delta = event.key === "ArrowDown" ? 1 : -1
    const destination = index + delta
    if (destination < 0 || destination >= plan.items.length) return
    event.preventDefault()
    event.stopPropagation()
    const items = [...plan.items]
    const [item] = items.splice(index, 1)
    items.splice(destination, 0, item)
    void reorder(
      item,
      items[destination - 1]?.id ?? null,
      items[destination + 1]?.id ?? null
    )
    return
  }
  if (event.key === "ArrowDown") {
    event.preventDefault()
    store.setActiveItem(
      plan.items[Math.min(plan.items.length - 1, Math.max(0, index + 1))].id
    )
  } else if (event.key === "ArrowUp") {
    event.preventDefault()
    store.setActiveItem(plan.items[Math.max(0, index - 1)].id)
  } else if (event.key === "Enter" && index >= 0) {
    event.preventDefault()
    activatePlanItem(plan.items[index])
  }
}
