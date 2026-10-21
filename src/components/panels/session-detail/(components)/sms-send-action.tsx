import { useState } from "react"
import { SendIcon } from "lucide-react"
import { Dialog, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { SendSmsDialog } from "../(modals)/send-sms-dialog"

export function SmsSendAction({
  sessionId,
  message,
  disabled,
}: {
  sessionId: number
  message: string
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <SendIcon className="size-3.5" />
          Send SMS
        </Button>
      </DialogTrigger>
      {open && <SendSmsDialog sessionId={sessionId} message={message} />}
    </Dialog>
  )
}
