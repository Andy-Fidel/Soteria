import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { persistBrandConfig, useSettingsStore } from "@/stores/settings-store"

type Field =
  | "churchName"
  | "campusName"
  | "defaultSpeakerName"
  | "welcomeTitle"
  | "welcomeMessage"
export function ChurchProfileFields({
  fields,
}: {
  fields: { key: Field; label: string; placeholder?: string }[]
}) {
  const brand = useSettingsStore((s) => s.brand)
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map(({ key }) => [key, brand[key] ?? ""]))
  )
  const [saving, setSaving] = useState(false)
  const dirty = fields.some(({ key }) => values[key] !== (brand[key] ?? ""))
  const save = async () => {
    setSaving(true)
    const patch = Object.fromEntries(
      fields.map(({ key }) => [key, values[key].trim() || null])
    )
    const saved = await persistBrandConfig(patch)
    setSaving(false)
    if (!saved) {
      toast.error("Could not save. Try again.")
      return
    }
    setValues(
      Object.fromEntries(fields.map(({ key }) => [key, values[key].trim()]))
    )
    toast.success("Profile saved")
  }
  return (
    <div className="space-y-4">
      {fields.map(({ key, label, placeholder }) => (
        <label key={key} className="block space-y-1.5 text-xs font-medium">
          {label}
          <Input
            value={values[key]}
            placeholder={placeholder}
            maxLength={120}
            disabled={saving}
            onChange={(e) => setValues({ ...values, [key]: e.target.value })}
          />
        </label>
      ))}
      <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  )
}
