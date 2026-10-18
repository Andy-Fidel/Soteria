export function SummaryCard({
  title,
  tone = "default",
  children,
}: {
  title: string
  tone?: "default" | "primary" | "accent"
  children: React.ReactNode
}) {
  const border =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : tone === "accent"
        ? "border-amber-500/25 bg-amber-500/5"
        : "border-border bg-muted/20"
  return (
    <div className={`flex flex-col gap-2 rounded-lg border p-3 ${border}`}>
      <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {title}
      </span>
      {children}
    </div>
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
    <div className={compact ? "mt-2" : ""}>
      <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-foreground/85">{value}</p>
    </div>
  )
}
