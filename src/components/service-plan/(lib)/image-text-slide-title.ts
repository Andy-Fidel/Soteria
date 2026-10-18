import type { PlanItem, PlanItemBlank, SermonSession } from "@/types"

/** Use the existing AI-verified announcement; never treat a manual session name as evidence. */
export function resolveImageSlideTitle(
  item: PlanItem,
  parsed: PlanItemBlank,
  session: SermonSession | null,
  editedTitle: string | null
): string {
  if (editedTitle !== null) return editedTitle
  const saved = parsed.textOverlay?.title ?? ""
  if (saved.trim()) return saved
  if (
    parsed.textOverlay?.layout === "title" &&
    item.planKind === "session" &&
    session?.id === item.planId &&
    session.titleSource === "announced"
  )
    return session.title
  return saved
}
