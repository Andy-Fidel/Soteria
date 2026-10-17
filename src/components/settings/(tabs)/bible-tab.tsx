import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface TranslationInfo {
  id: number
  abbreviation: string
  title: string
  language: string
}

export function BibleSection() {
  const [translations, setTranslations] = useState<TranslationInfo[]>([])
  const [activeId, setActiveId] = useState<number>(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [trans, active] = await Promise.all([
          invoke<TranslationInfo[]>("list_translations"),
          invoke<number>("get_active_translation"),
        ])
        setTranslations(trans)
        setActiveId(active)
      } catch (e) {
        console.error("Failed to load translations:", e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleChange = (value: string) => {
    const id = parseInt(value)
    setActiveId(id)
    void import("@/lib/switch-translation").then(({ switchTranslation }) =>
      switchTranslation(id)
    )
  }

  const englishTranslations = translations.filter((t) => t.language === "en")
  const otherTranslations = translations.filter((t) => t.language !== "en")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Primary Translation
        </label>
        <Select
          value={String(activeId)}
          onValueChange={handleChange}
          disabled={loading}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue
              placeholder={loading ? "Loading..." : "Select translation"}
            />
          </SelectTrigger>
          <SelectContent>
            {englishTranslations.length > 0 && (
              <>
                <div className="px-2 py-1 text-[0.5625rem] font-medium tracking-wider text-muted-foreground uppercase">
                  English
                </div>
                {englishTranslations.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.abbreviation} — {t.title}
                  </SelectItem>
                ))}
              </>
            )}
            {otherTranslations.length > 0 && (
              <>
                <div className="mt-1 px-2 py-1 text-[0.5625rem] font-medium tracking-wider text-muted-foreground uppercase">
                  Other Languages
                </div>
                {otherTranslations.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.abbreviation} — {t.title}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        <p className="text-[0.625rem] text-muted-foreground">
          Detected verses will display in this translation.
          {translations.length > 0 &&
            ` ${translations.length} translations available.`}
        </p>
      </div>
    </div>
  )
}
