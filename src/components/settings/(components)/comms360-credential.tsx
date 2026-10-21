import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckIcon } from "lucide-react"

interface Settings {
  configured: boolean
  senderId: string
  contactListId: string
}
export function Comms360Credential() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [key, setKey] = useState("")
  const [sender, setSender] = useState("")
  const [contactList, setContactList] = useState("")
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let cancelled = false
    invoke<Settings>("get_comms360_settings")
      .then((value) => {
        if (cancelled) return
        setSettings(value)
        setSender(value.senderId)
        setContactList(value.contactListId)
        setError("")
      })
      .catch((error) => {
        if (!cancelled) setError(String(error))
      })
    return () => {
      cancelled = true
    }
  }, [])
  const save = async () => {
    setSaving(true)
    setError("")
    try {
      const value = await invoke<Settings>("save_comms360_settings", {
        apiKey: key,
        senderId: sender,
        contactListId: contactList,
      })
      setSettings(value)
      setSender(value.senderId)
      setContactList(value.contactListId)
      setKey("")
      setSaved(true)
    } catch (error) {
      setError(String(error))
    } finally {
      setSaving(false)
    }
  }
  return (
    <section aria-label="Comms360 SMS" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Comms360 API Key
        </h3>
        <Badge
          variant="outline"
          className={`text-[0.5rem] ${settings?.configured ? "" : "text-muted-foreground"}`}
        >
          {settings?.configured ? "Key configured" : "Not set"}
        </Badge>
      </div>
      <div className="flex gap-2">
        <Input
          aria-label="Comms360 API key"
          type="password"
          autoComplete="off"
          value={key}
          onChange={(event) => {
            setKey(event.target.value)
            setSaved(false)
          }}
          className="flex-1 text-xs"
          disabled={saving || !settings}
          placeholder={
            settings?.configured
              ? "Leave blank to keep the saved key"
              : "Enter your Comms360 API key"
          }
        />
        <Button
          size="sm"
          onClick={() => void save()}
          disabled={
            saving ||
            !settings ||
            !sender.trim() ||
            !contactList.trim() ||
            (!key.trim() && !settings.configured)
          }
        >
          {saving ? (
            "Saving…"
          ) : saved ? (
            <>
              <CheckIcon className="size-3" />
              Saved
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
      <label className="space-y-1 text-[0.625rem] text-muted-foreground">
        Approved sender ID
        <Input
          value={sender}
          onChange={(event) => {
            setSender(event.target.value)
            setSaved(false)
          }}
          maxLength={20}
          disabled={saving || !settings}
          placeholder="Your approved sender name"
          className="text-xs"
        />
      </label>
      <label className="space-y-1 text-[0.625rem] text-muted-foreground">
        SMS contact list ID
        <Input
          value={contactList}
          onChange={(event) => {
            setContactList(event.target.value)
            setSaved(false)
          }}
          disabled={saving || !settings}
          placeholder="Saved Comms360 contact list ID"
          className="text-xs"
        />
      </label>
      {error && (
        <p role="alert" className="text-[0.625rem] text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
