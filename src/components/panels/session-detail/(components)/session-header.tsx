import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeftIcon,
  StopCircleIcon,
  SparklesIcon,
  MicIcon,
  BookOpenIcon,
  BarChart3Icon,
  ImagesIcon,
} from "lucide-react"
import type { DetailTab } from "../(lib)/types"
interface SessionHeaderProps {
  sessionTitle: string
  status?: string
  tab: DetailTab
  onBack: () => void
  onEndSession: () => void
  onTabChange: (tab: DetailTab) => void
  exportMenu: ReactNode
  metadata: ReactNode
}
export function SessionHeader({
  sessionTitle,
  status,
  tab,
  onBack,
  onEndSession,
  onTabChange,
  exportMenu,
  metadata,
}: SessionHeaderProps) {
  return (
    <>
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-1 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-xs" onClick={onBack}>
            <ArrowLeftIcon className="size-3.5" />
          </Button>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
            {sessionTitle}
          </span>
          {status === "live" && (
            <Badge
              variant="outline"
              className="shrink-0 border-amber-500/30 bg-amber-500/10 text-[9px] text-amber-500"
            >
              Still Live
            </Badge>
          )}

          {/* End session for orphaned live sessions */}
          {status === "live" && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1 text-destructive hover:text-destructive"
              onClick={onEndSession}
            >
              <StopCircleIcon className="size-3" />
              End Session
            </Button>
          )}

          {exportMenu}
        </div>
        {metadata}
      </div>
      {/* Tabs */}
      <div className="flex shrink-0 gap-1 border-b border-border px-3 py-1.5">
        {(
          ["summary", "transcript", "detections", "slides", "stats"] as const
        ).map((t) => (
          <button
            key={t}
            onClick={() => onTabChange(t)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            {t === "summary" && <SparklesIcon className="size-3" />}
            {t === "transcript" && <MicIcon className="size-3" />}
            {t === "detections" && <BookOpenIcon className="size-3" />}
            {t === "slides" && <ImagesIcon className="size-3" />}
            {t === "stats" && <BarChart3Icon className="size-3" />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </>
  )
}
