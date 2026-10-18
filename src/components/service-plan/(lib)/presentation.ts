import { useServicePlanStore } from "@/stores/service-plan-store"
import { activatePlanItem } from "../activation-router"

/** Arm auto-advance only after this item reaches live output. */
export function markPlanItemPresented(itemId: number): void {
  const store = useServicePlanStore.getState()
  const plan = store.plan
  const item = plan?.items.find((item) => item.id === itemId)
  if (!plan || !item) return
  store.cancelPendingAdvance()
  useServicePlanStore.setState({
    presentedItemId: itemId,
    activeItemId: itemId,
  })
  const seconds = item.autoAdvanceSeconds
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return
  const ms = seconds * 1000
  const timer = setTimeout(() => {
    const current = useServicePlanStore.getState()
    if (
      current.plan?.planId !== plan.planId ||
      current.plan.planKind !== plan.planKind ||
      current.presentedItemId !== itemId
    )
      return
    current.cancelPendingAdvance()
    const next = current.nextPlayableAfter(itemId)
    if (next) activatePlanItem(next)
  }, ms)
  store.setPendingAdvance(timer, Date.now() + ms, ms)
}
