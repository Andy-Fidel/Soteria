import { useState } from "react"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useServicePlan } from "@/hooks/use-service-plan"
import { useSessionStore } from "@/stores/session-store"
import type { PlanItemPayload } from "@/types"
import { AddVerseDialog } from "./add-verse-dialog"
import { AddSongDialog } from "./add-song-dialog"
import { AddPlanSheet } from "./(modals)/add-plan-sheet"

export function AddItemMenu() {
  const { addItem } = useServicePlan()
  const hasSession = useSessionStore((s) => s.activeSession !== null)
  const [mode, setMode] = useState<"closed" | "picker" | "verse" | "song">("closed")
  const [adding, setAdding] = useState(false)

  const add = async (payload: PlanItemPayload) => {
    if (adding || !hasSession) return
    setAdding(true)
    try {
      await addItem(payload.type, payload)
      setMode("closed")
    } catch (error) {
      toast.error(`Could not add item: ${error}`)
    } finally {
      setAdding(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5" disabled={!hasSession} onClick={() => setMode("picker")}>
        <PlusIcon className="size-3.5" />
        Add
      </Button>
      <AddPlanSheet
        open={mode === "picker"}
        onOpenChange={(open) => { if (!open) setMode("closed") }}
        adding={adding}
        onAdd={(payload) => void add(payload)}
        onVerse={() => setMode("verse")}
        onSong={() => setMode("song")}
      />
      <AddVerseDialog open={mode === "verse"} onOpenChange={(open) => { if (!open) setMode("closed") }} />
      <AddSongDialog open={mode === "song"} onOpenChange={(open) => { if (!open) setMode("closed") }} />
    </>
  )
}
