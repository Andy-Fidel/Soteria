import { joinRecap, splitRecap } from "../(lib)/recap-sections"

export function RecapEditor({ value, disabled, onChange }: {
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  const sections = splitRecap(value)
  return <div className="space-y-5">
    {([
      ["message", "Message", "The sermon’s central message and key Scripture…", "min-h-64"],
      ["reflection", "Reflection", "One question to carry into the week…", "min-h-20"],
      ["prayer", "Prayer", "A short prayer in response to the message…", "min-h-24"],
    ] as const).map(([key, label, placeholder, height]) => (
      <label key={key} className={`block space-y-2 text-xs font-semibold ${key !== "message" ? "border-t border-border pt-4" : ""}`}>
        {label}
        <textarea
          value={sections[key]}
          disabled={disabled}
          onChange={(event) => {
            const recap = joinRecap({ ...sections, [key]: event.target.value })
            if (recap.length <= 10000) onChange(recap)
          }}
          placeholder={placeholder}
          className={`${height} w-full resize-y rounded-md border border-input bg-background p-3 text-sm font-normal leading-relaxed disabled:opacity-60`}
        />
      </label>
    ))}
  </div>
}
