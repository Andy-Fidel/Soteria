import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useSettingsStore, persistSttProvider } from "@/stores"
import { useSettingsDialogStore } from "@/lib/settings-dialog"

export function SpeechSection() {
  const { sttProvider, deepgramApiKey, assemblyAiApiKey } = useSettingsStore()
  const setActiveSection = useSettingsDialogStore((s) => s.setActiveSection)

  const selectedKeyStatus =
    sttProvider === "deepgram"
      ? { label: "Deepgram API Key", configured: Boolean(deepgramApiKey) }
      : sttProvider === "assemblyai"
        ? { label: "AssemblyAI API Key", configured: Boolean(assemblyAiApiKey) }
        : null

  return (
    <div className="flex flex-col gap-6">
      {/* Provider selector */}
      <div className="flex flex-col gap-3">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Provider
        </label>

        <RadioGroup
          value={sttProvider}
          onValueChange={(v) =>
            persistSttProvider(v as "deepgram" | "assemblyai" | "whisper")
          }
          className="gap-3"
        >
          {/* Deepgram (cloud) */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
              sttProvider !== "deepgram"
                ? "hover:border-muted-foreground/25"
                : ""
            }`}
          >
            <RadioGroupItem value="deepgram" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                Cloud (Deepgram)
              </span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Uses Deepgram Nova-3 for real-time streaming transcription.
                Requires an API key and internet connection. Best accuracy with
                keyword boosting for Bible terms.
              </p>
            </div>
          </label>

          {/* AssemblyAI (cloud) */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
              sttProvider !== "assemblyai"
                ? "hover:border-muted-foreground/25"
                : ""
            }`}
          >
            <RadioGroupItem value="assemblyai" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                Cloud (AssemblyAI)
              </span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Uses AssemblyAI Universal-Streaming. Cheaper than Deepgram
                ($0.15/hr), strong proper-noun accuracy via keyterms prompting.
                Requires an API key and internet connection.
              </p>
            </div>
          </label>

          {/* Whisper (local) */}
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-data-[state=checked]:border-primary/50 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:ring-1 has-data-[state=checked]:ring-primary/20 ${
              sttProvider !== "whisper"
                ? "hover:border-muted-foreground/25"
                : ""
            }`}
          >
            <RadioGroupItem value="whisper" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                Local (Whisper)
              </span>
              <p className="text-[0.625rem] leading-relaxed text-muted-foreground">
                Transcribes English on your device. The Mac app includes
                Small English. No speech API key or internet is needed.
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {selectedKeyStatus ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground">
                {selectedKeyStatus.label}
              </span>
              <p className="text-[0.625rem] text-muted-foreground">
                Cloud transcription keys are managed in API Keys.
              </p>
            </div>
            {selectedKeyStatus.configured ? (
              <Badge variant="outline" className="text-[0.5rem]">
                Key configured
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[0.5rem] text-muted-foreground"
              >
                Not set
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveSection("api-keys")}
          >
            Manage key
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <p className="text-xs font-medium text-foreground">
            No cloud key required
          </p>
          <p className="mt-1 text-[0.625rem] text-muted-foreground">
            Whisper runs locally. Use API Keys only for summaries, image search,
            or song lookup.
          </p>
        </div>
      )}
    </div>
  )
}
