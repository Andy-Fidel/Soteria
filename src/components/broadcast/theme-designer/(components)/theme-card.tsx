import { MoreHorizontalIcon, HeartIcon } from "lucide-react"
import { CanvasVerse } from "@/components/ui/canvas-verse"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import type { BroadcastTheme } from "@/types"
import { cn } from "@/lib/utils"
const SAMPLE = {
  reference: "John 3:16 (KJV)",
  segments: [{ text: "For God so loved the world." }],
}
export function ThemeCard({
  theme,
  active,
  editing,
  onSelect,
  onPin,
  onDuplicate,
  onRename,
  onDelete,
}: {
  theme: BroadcastTheme
  active: boolean
  editing: boolean
  onSelect: () => void
  onPin: () => void
  onDuplicate: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        "relative rounded-lg p-1.5",
        editing && "ring-2 ring-primary"
      )}
    >
      <button
        onClick={onSelect}
        aria-label={`Edit ${theme.name}`}
        aria-pressed={editing}
        className="block w-full rounded-lg text-left focus-visible:outline-2 focus-visible:outline-ring"
      >
        <div
          className="pointer-events-none relative overflow-hidden rounded-lg bg-black"
          style={{
            aspectRatio: theme.resolution.width / theme.resolution.height,
          }}
        >
          <CanvasVerse theme={theme} verse={SAMPLE} />
          {active && (
            <Badge className="absolute top-1 left-1 bg-emerald-600 text-[9px] text-white">
              Main output
            </Badge>
          )}
          {theme.pinned && (
            <HeartIcon className="absolute top-2 right-2 size-3 fill-current text-primary" />
          )}
        </div>
        <span className="block truncate pt-1 pr-7 text-xs font-medium">
          {theme.name}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {theme.builtin ? "Built-in" : "Custom"}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute right-1 bottom-3"
            aria-label={`Actions for ${theme.name}`}
          >
            <MoreHorizontalIcon className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onPin}>
            {theme.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>Duplicate</DropdownMenuItem>
          {!theme.builtin && (
            <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
          )}
          {!theme.builtin && (
            <DropdownMenuItem onSelect={onDelete}>Delete</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
