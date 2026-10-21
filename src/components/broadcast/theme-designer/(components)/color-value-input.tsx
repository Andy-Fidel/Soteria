import { useState } from "react"
import { Input } from "@/components/ui/input"

/** Keep incomplete hex input local until the operator finishes typing. */
export function ColorValueInput({
  value,
  onValueChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string
  onValueChange: (color: string) => void
}) {
  const [edit, setEdit] = useState({ source: value, text: value })
  const text = edit.source === value ? edit.text : value
  const valid = /^#[0-9a-f]{6}$/i.test(text)
  const commit = () => {
    if (valid) onValueChange(text)
    else setEdit({ source: value, text: value })
  }
  return (
    <Input
      {...props}
      value={text}
      aria-label={props["aria-label"] ?? "Hex color"}
      aria-invalid={!valid}
      onChange={(e) => setEdit({ source: value, text: e.target.value })}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          e.currentTarget.blur()
        }
        if (e.key === "Escape") setEdit({ source: value, text: value })
      }}
    />
  )
}
