import { APP_LOGO_URL, APP_NAME } from "@/lib/brand"
import { cn } from "@/lib/utils"

export function AppLogo({ className }: { className?: string }) {
  return (
    <img
      src={APP_LOGO_URL}
      alt={APP_NAME}
      width={1536}
      height={1024}
      className={cn("object-contain", className)}
    />
  )
}
