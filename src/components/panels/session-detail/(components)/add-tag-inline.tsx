import { useState } from "react"
import { Input } from "@/components/ui/input"
export function AddTagInline({ onAdd }: { onAdd: (tag: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
      >
        + Tag
      </button>
    )
  }

  const commit = () => {
    if (value.trim()) onAdd(value)
    setValue("")
    setOpen(false)
  }

  return (
    <Input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit()
        if (e.key === "Escape") {
          setValue("")
          setOpen(false)
        }
      }}
      placeholder="tag…"
      className="h-6 w-24 text-[11px]"
    />
  )
}
