import { useState, useEffect, useCallback } from "react"
import { invoke } from "@tauri-apps/api/core"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useSettingsStore } from "@/stores"
import { AudioTestPanel } from "@/components/audio-test-panel"
import type { DeviceInfo } from "@/types/audio"

export function AudioSection() {
  const { audioDeviceId, gain } = useSettingsStore()

  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [loading, setLoading] = useState(true)

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true)
      const result = await invoke<DeviceInfo[]>("get_audio_devices")
      setDevices(result)
    } catch {
      // Tauri command may not be available during dev
      setDevices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDevices()
  }, [loadDevices])

  // gain is 0.0-2.0 in store, display as 0-100%
  const gainPercent = Math.round((gain / 2.0) * 100)

  return (
    <div className="flex flex-col gap-6">
      {/* Device selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Input Device
        </label>
        <Select
          value={audioDeviceId ?? "__default__"}
          onValueChange={(v) => {
            import("@/stores/settings-store").then(({ persistAudioDeviceId }) =>
              persistAudioDeviceId(v === "__default__" ? null : v)
            )
          }}
          disabled={loading}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue
              placeholder={loading ? "Loading devices..." : "System default"}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">System default</SelectItem>
            {devices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.name}
                {device.is_default ? " (default)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[0.625rem] text-muted-foreground">
          Selected device persists across sessions. Leave as system default to
          follow OS audio routing.
        </p>
        <div className="rounded-md bg-muted/50 px-3 py-2 text-[0.625rem] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/70">Tip:</span> To
          capture audio from a soundboard, video, or another app, use a virtual
          audio device like <span className="font-medium">BlackHole</span>{" "}
          (free). Set up a Multi-Output Device in macOS Audio MIDI Setup to hear
          audio and route it to Manna simultaneously.
        </div>
      </div>

      {/* Input gain */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Input Gain
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {gainPercent}%
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[gainPercent]}
          onValueChange={([v]) => {
            import("@/stores/settings-store").then(({ persistGain }) =>
              persistGain((v / 100) * 2.0)
            )
          }}
        />
        <p className="text-[0.625rem] text-muted-foreground">
          Amplifies the incoming audio signal before transcription. 50% is unity
          gain.
        </p>
      </div>

      {/* Live mic test — reads the real cpal stream, not WebKit getUserMedia */}
      <AudioTestPanel deviceId={audioDeviceId} gain={gain} />
    </div>
  )
}
