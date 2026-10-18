import { BookOpenIcon, MusicIcon, MegaphoneIcon, ListIcon, MinusIcon, SquareIcon, HeartHandshakeIcon, XIcon } from "lucide-react"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { useSettingsStore } from "@/stores/settings-store"
import { resolveBrandAsset } from "@/lib/brand"
import type { PlanItemPayload } from "@/types"
import { WELCOME_SLIDE } from "../(lib)/welcome-slide"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  adding: boolean
  onAdd: (payload: PlanItemPayload) => void
  onVerse: () => void
  onSong: () => void
}

export function AddPlanSheet({ open, onOpenChange, adding, onAdd, onVerse, onSong }: Props) {
  const brand = useSettingsStore((s) => s.brand)
  const items = [
    { label: "Scripture", description: "Choose a Bible passage", icon: BookOpenIcon, action: onVerse },
    { label: "Song", description: "Choose from your song library", icon: MusicIcon, action: onSong },
    { label: "Announcement", description: "Add a message for the congregation", icon: MegaphoneIcon, action: () => onAdd({ type: "announcement", title: "New Announcement", body: "" }) },
    { label: "Prayer points", description: "Select notes to present during prayer", icon: HeartHandshakeIcon, action: () => onAdd({ type: "notes", title: "Prayer Points", lastSelection: [] }) },
    { label: "Notes", description: "Present selected session notes", icon: ListIcon, action: () => onAdd({ type: "notes", title: "", lastSelection: [] }) },
    { label: "Section header", description: "Organize your service plan", icon: MinusIcon, action: () => onAdd({ type: "section", label: "New Section" }) },
    { label: "Blank / logo", description: "Show your church logo", icon: SquareIcon, action: () => onAdd({ type: "blank", showLogo: true }) },
  ]
  const slides: Array<{ label: string; image: string; payload: PlanItemPayload }> = [
    { label: "EWC Adenta — Welcome", image: WELCOME_SLIDE.imageUrl!, payload: WELCOME_SLIDE },
    { label: "MoMo", image: resolveBrandAsset("momo", brand.momoImagePath), payload: { type: "momo" } },
    { label: "Jesus", image: resolveBrandAsset("jesus", brand.jesusImagePath), payload: { type: "jesus" } },
  ]

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="left-1/2 right-auto max-h-[85vh] w-full max-w-2xl -translate-x-1/2">
        <DrawerHeader>
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle>Add to service plan</DrawerTitle>
            <DrawerClose asChild>
              <Button size="icon-sm" variant="ghost" aria-label="Close add sheet"><XIcon className="size-4" /></Button>
            </DrawerClose>
          </div>
          <DrawerDescription>Choose an item or a ready-made slide to add to your plan.</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-5" aria-busy={adding}>
          <Tabs defaultValue="items" className="gap-4">
            <TabsList className="w-full">
              <TabsTrigger value="items" className="flex-1">Items</TabsTrigger>
              <TabsTrigger value="slides" className="flex-1">Slides</TabsTrigger>
            </TabsList>
            <TabsContent value="items" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {items.map(({ label, description, icon: Icon, action }) => (
                <button key={label} disabled={adding} onClick={action} className="flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
                  <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                  <span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span>
                </button>
              ))}
            </TabsContent>
            <TabsContent value="slides" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {slides.map(({ label, image, payload }) => (
                <button key={label} disabled={adding} onClick={() => onAdd(payload)} aria-label={`Add ${label}`} className="overflow-hidden rounded-lg border text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
                  <img src={image} alt={label} className="aspect-video w-full bg-black object-contain" />
                  <span className="block p-3 text-sm font-medium">{label}</span>
                </button>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
