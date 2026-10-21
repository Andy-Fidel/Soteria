import { useId, type ReactNode } from "react"

export function SummaryCard({
  title,
  tone = "default",
  children,
  action,
}: {
  title: string
  tone?: "default" | "primary" | "accent"
  children: ReactNode
  action?: ReactNode
}) {
  const headingId = useId()
  const treatment =
    tone === "primary"
      ? "border-l-3 border-primary pl-5"
      : tone === "accent"
        ? "rounded-lg bg-primary/5 p-5 sm:p-6"
        : ""
  return (
    <section
      aria-labelledby={headingId}
      className={`flex min-w-0 flex-col gap-4 ${treatment}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id={headingId}
          className="text-lg leading-snug font-semibold tracking-tight"
        >
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function SummaryField({
  label,
  value,
  compact = false,
}: {
  label: string
  value: string
  compact?: boolean
}) {
  return (
    <div className={compact ? "mt-5" : ""}>
      <h3 className="text-sm leading-relaxed font-semibold text-foreground">
        {label}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  )
}
