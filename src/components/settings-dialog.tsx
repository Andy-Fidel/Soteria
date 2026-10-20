import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { XIcon } from "lucide-react"
import { useSettingsDialogStore } from "@/lib/settings-dialog"
import {
  navItems,
  navGroups,
  sectionTitles,
  sectionComponents,
  type NavSection,
} from "./settings/(components)/settings-navigation"
export function SettingsDialog() {
  const open = useSettingsDialogStore((s) => s.isOpen)
  const activeSection = useSettingsDialogStore((s) => s.activeSection)
  const setActiveSection = useSettingsDialogStore((s) => s.setActiveSection)
  const closeSettings = useSettingsDialogStore((s) => s.closeSettings)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        closeSettings()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, closeSettings])

  if (!open) return null

  const ActiveContent = sectionComponents[activeSection]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-50 flex animate-in flex-col bg-background duration-150 fade-in-0"
    >
      <SidebarProvider className="min-h-0 flex-1 items-start">
        <Sidebar
          collapsible="none"
          className="hidden h-full w-64 shrink-0 md:flex"
        >
          <div className="flex h-14 items-center border-r border-b border-border px-4 text-sm font-medium">
            Settings
          </div>
          <SidebarContent className="border-r border-border">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navGroups.map((group) => {
                    const items = navItems.filter(
                      (item) => item.group === group
                    )
                    return (
                      <div key={group} className="space-y-1">
                        <div className="px-2 pt-3 text-[0.625rem] font-semibold tracking-wider text-muted-foreground/70 uppercase first:pt-1">
                          {group}
                        </div>
                        {items.map((item) => (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              isActive={item.id === activeSection}
                              onClick={() => setActiveSection(item.id)}
                            >
                              {item.icon}
                              <span>{item.name}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </div>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex h-full flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="hidden text-sm font-medium md:block">
                {sectionTitles[activeSection]}
              </div>
              <div className="min-w-0 flex-1 md:hidden">
                <Select
                  value={activeSection}
                  onValueChange={(value) =>
                    setActiveSection(value as NavSection)
                  }
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {navGroups.map((group) => (
                      <div key={group}>
                        <div className="px-2 py-1 text-[0.5625rem] font-medium tracking-wider text-muted-foreground uppercase">
                          {group}
                        </div>
                        {navItems
                          .filter((item) => item.group === group)
                          .map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={closeSettings}
              aria-label="Close settings"
            >
              <XIcon className="size-4" />
            </Button>
          </header>
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div
              className={
                activeSection === "branding"
                  ? "mx-auto min-h-full w-full max-w-5xl"
                  : "mx-auto w-full max-w-3xl p-8"
              }
            >
              <ActiveContent />
            </div>
          </div>
        </main>
      </SidebarProvider>
    </div>
  )
}
