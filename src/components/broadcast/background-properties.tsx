import { ImageEffectSlider } from "./theme-designer/(components)/image-effect-slider"
import { parseColorOpacity, buildColorWithOpacity } from "@/lib/color-value"
import { ThemeImageUpload } from "./theme-designer/(components)/theme-image-upload"
import { ColorValueInput } from "./theme-designer/(components)/color-value-input"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

function SolidSection() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)

  if (!draftTheme) return null

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        Background Color
      </label>
      <div className="flex items-center gap-2">
        <input
          aria-label="Background Color"
          type="color"
          value={draftTheme.background.color}
          onChange={(e) => update("background.color", e.target.value)}
          className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
        />
        <ColorValueInput
          aria-label="Background Color"
          value={draftTheme.background.color}
          onValueChange={(v) => {
            update("background.color", v)
          }}
          className="w-24 font-mono"
        />
      </div>
    </div>
  )
}

function GradientSection() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)

  if (!draftTheme || !draftTheme.background.gradient) return null

  const gradient = draftTheme.background.gradient
  const stop0 = gradient.stops[0] ?? { color: "#000000", position: 0 }
  const stop1 = gradient.stops[1] ?? { color: "#ffffff", position: 100 }

  return (
    <div className="flex flex-col gap-3">
      {/* Gradient Type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Gradient Type
        </label>
        <Select
          value={gradient.type}
          onValueChange={(v) => update("background.gradient.type", v)}
        >
          <SelectTrigger aria-label="Gradient Type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="linear">Linear</SelectItem>
            <SelectItem value="radial">Radial</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Angle (only for linear) */}
      {gradient.type === "linear" && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Angle
            </label>
            <span className="text-xs text-muted-foreground tabular-nums">
              {gradient.angle}&deg;
            </span>
          </div>
          <Slider
            aria-label="Angle"
            min={0}
            max={360}
            step={1}
            value={[gradient.angle]}
            onValueChange={([v]) => update("background.gradient.angle", v)}
          />
        </div>
      )}

      {/* Color Stop 1 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Color Stop 1
        </label>
        <div className="flex items-center gap-2">
          <input
            aria-label="Color Stop 1"
            type="color"
            value={stop0.color}
            onChange={(e) =>
              update("background.gradient.stops.0.color", e.target.value)
            }
            className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
          />
          <ColorValueInput
            aria-label="Color Stop 1"
            value={stop0.color}
            onValueChange={(v) => {
              update("background.gradient.stops.0.color", v)
            }}
            className="w-20 font-mono"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Position
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {stop0.position}%
          </span>
        </div>
        <Slider
          aria-label="Position"
          min={0}
          max={100}
          step={1}
          value={[stop0.position]}
          onValueChange={([v]) =>
            update("background.gradient.stops.0.position", v)
          }
        />
      </div>

      {/* Color Stop 2 */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Color Stop 2
        </label>
        <div className="flex items-center gap-2">
          <input
            aria-label="Color Stop 2"
            type="color"
            value={stop1.color}
            onChange={(e) =>
              update("background.gradient.stops.1.color", e.target.value)
            }
            className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
          />
          <ColorValueInput
            aria-label="Color Stop 2"
            value={stop1.color}
            onValueChange={(v) => {
              update("background.gradient.stops.1.color", v)
            }}
            className="w-20 font-mono"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Position
          </label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {stop1.position}%
          </span>
        </div>
        <Slider
          aria-label="Position"
          min={0}
          max={100}
          step={1}
          value={[stop1.position]}
          onValueChange={([v]) =>
            update("background.gradient.stops.1.position", v)
          }
        />
      </div>
    </div>
  )
}

function ImageSection() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)

  if (!draftTheme || !draftTheme.background.image) return null

  const image = draftTheme.background.image
  const tint = image.tint
    ? parseColorOpacity(image.tint)
    : { hex: "#000000", opacity: 50 }

  return (
    <div className="flex flex-col gap-3">
      {/* Image Source */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Background Image
        </label>
        <ThemeImageUpload
          key={draftTheme.id}
          themeId={draftTheme.id}
          path="background.image.url"
          label="Change Image"
        />
      </div>

      {/* Fit Mode */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Fit Mode
        </label>
        <Select
          value={image.fit}
          onValueChange={(v) => update("background.image.fit", v)}
        >
          <SelectTrigger aria-label="Fit Mode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">Cover</SelectItem>
            <SelectItem value="contain">Contain</SelectItem>
            <SelectItem value="stretch">Stretch</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Effects */}
      <div className="flex flex-col gap-3 border-t pt-3">
        <h4 className="text-xs font-semibold">Effects</h4>

        <ImageEffectSlider
          key={`blur-${draftTheme.id}`}
          label="Blur"
          value={image.blur}
          max={50}
          suffix="px"
          onCommit={(value) => update("background.image.blur", value)}
        />
        <ImageEffectSlider
          key={`brightness-${draftTheme.id}`}
          label="Brightness"
          value={image.brightness}
          max={200}
          suffix="%"
          onCommit={(value) => update("background.image.brightness", value)}
        />
        <p className="text-xs text-muted-foreground">
          Effects update when you release the slider.
        </p>
      </div>

      {/* Color Overlay */}
      <div className="flex flex-col gap-3 border-t pt-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold">Color Overlay</h4>
          <input
            aria-label="Brightness"
            type="checkbox"
            checked={image.tint !== null}
            onChange={(e) => {
              if (e.target.checked) {
                update(
                  "background.image.tint",
                  buildColorWithOpacity("#000000", 50)
                )
              } else {
                update("background.image.tint", null)
              }
            }}
            className="h-4 w-4 rounded border-input accent-primary"
          />
        </div>

        {image.tint !== null && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <input
                aria-label="Brightness"
                type="color"
                value={tint.hex}
                onChange={(e) =>
                  update(
                    "background.image.tint",
                    buildColorWithOpacity(e.target.value, tint.opacity)
                  )
                }
                className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
              />
              <ColorValueInput
                aria-label="Brightness"
                value={tint.hex}
                onValueChange={(v) => {
                  update(
                    "background.image.tint",
                    buildColorWithOpacity(v, tint.opacity)
                  )
                }}
                className="w-20 font-mono"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Opacity
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {tint.opacity}%
              </span>
            </div>
            <Slider
              aria-label="Opacity"
              min={0}
              max={100}
              step={1}
              value={[tint.opacity]}
              onValueChange={([v]) =>
                update(
                  "background.image.tint",
                  buildColorWithOpacity(tint.hex, v)
                )
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}

function TransparentSection() {
  return (
    <div className="rounded-md border border-dashed p-3">
      <p className="text-xs text-muted-foreground">
        Background is transparent for NDI overlay mode
      </p>
    </div>
  )
}

function TextBoxSection() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)

  if (!draftTheme) return null

  const textBox = draftTheme.textBox
  const { hex: boxColorHex } = parseColorOpacity(textBox.color)

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold">Text Box</h4>
        <input
          aria-label="Opacity"
          type="checkbox"
          checked={textBox.enabled}
          onChange={(e) => update("textBox.enabled", e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
      </div>

      {textBox.enabled && (
        <div className="flex flex-col gap-3">
          {/* Color */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                aria-label="Color"
                type="color"
                value={boxColorHex}
                onChange={(e) => update("textBox.color", e.target.value)}
                className="h-7 w-8 cursor-pointer rounded border border-input bg-transparent p-0.5"
              />
              <ColorValueInput
                aria-label="Color"
                value={boxColorHex}
                onValueChange={(v) => {
                  update("textBox.color", v)
                }}
                className="w-20 font-mono"
              />
            </div>
          </div>

          {/* Opacity */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Opacity
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.round(textBox.opacity * 100)}%
              </span>
            </div>
            <Slider
              aria-label="Opacity"
              min={0}
              max={100}
              step={1}
              value={[Math.round(textBox.opacity * 100)]}
              onValueChange={([v]) => update("textBox.opacity", v / 100)}
            />
          </div>

          {/* Border Radius */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Border Radius
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {textBox.borderRadius}px
              </span>
            </div>
            <Slider
              aria-label="Border Radius"
              min={0}
              max={50}
              step={1}
              value={[textBox.borderRadius]}
              onValueChange={([v]) => update("textBox.borderRadius", v)}
            />
          </div>

          {/* Padding */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Padding
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {textBox.padding}px
              </span>
            </div>
            <Slider
              aria-label="Padding"
              min={0}
              max={100}
              step={1}
              value={[textBox.padding]}
              onValueChange={([v]) => update("textBox.padding", v)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function BackgroundProperties() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)

  if (!draftTheme) return null

  const bgType = draftTheme.background.type

  return (
    <div className="flex flex-col gap-3">
      {/* Background Type */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Background Type
        </label>
        <Select
          value={bgType}
          onValueChange={(v) => {
            update("background.type", v)
            // Initialize gradient/image if switching to those types
            if (v === "gradient" && !draftTheme.background.gradient) {
              update("background.gradient", {
                type: "linear",
                angle: 180,
                stops: [
                  { color: "#000000", position: 0 },
                  { color: "#ffffff", position: 100 },
                ],
              })
            }
            if (v === "image" && !draftTheme.background.image) {
              update("background.image", {
                url: "",
                fit: "cover",
                blur: 0,
                brightness: 100,
                tint: null,
              })
            }
          }}
        >
          <SelectTrigger aria-label="Background Type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid Color</SelectItem>
            <SelectItem value="gradient">Gradient</SelectItem>
            <SelectItem value="image">Image</SelectItem>
            <SelectItem value="transparent">Transparent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Conditional sections */}
      {bgType === "solid" && <SolidSection />}
      {bgType === "gradient" && <GradientSection />}
      {bgType === "image" && <ImageSection />}
      {bgType === "transparent" && <TransparentSection />}

      {/* Text Box - always visible */}
      <TextBoxSection />

      {/* Logo */}
      <LogoSection />
    </div>
  )
}

function LogoSection() {
  const draftTheme = useBroadcastStore((s) => s.draftTheme)
  const update = useBroadcastStore((s) => s.updateDraftNested)
  if (!draftTheme) return null

  const logo = draftTheme.logo

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-foreground">Logo</label>
        <Switch
          aria-label="Logo"
          checked={!!logo}
          onCheckedChange={(checked) => {
            if (checked) {
              update("logo", {
                url: "",
                position: "top-right",
                size: 120,
                opacity: 1,
                margin: 40,
              })
            } else {
              update("logo", null)
            }
          }}
        />
      </div>

      {logo && (
        <div className="flex flex-col gap-2">
          <ThemeImageUpload
            key={draftTheme.id}
            themeId={draftTheme.id}
            path="logo.url"
            label={logo.url ? "Change Logo" : "Pick Logo"}
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Position
            </label>
            <Select
              value={logo.position}
              onValueChange={(v) => update("logo.position", v)}
            >
              <SelectTrigger aria-label="Position" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Size
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {logo.size}px
              </span>
            </div>
            <Slider
              aria-label="Size"
              min={32}
              max={400}
              step={4}
              value={[logo.size]}
              onValueChange={([v]) => update("logo.size", v)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Margin
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {logo.margin}px
              </span>
            </div>
            <Slider
              aria-label="Margin"
              min={0}
              max={200}
              step={2}
              value={[logo.margin]}
              onValueChange={([v]) => update("logo.margin", v)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Opacity
              </label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.round(logo.opacity * 100)}%
              </span>
            </div>
            <Slider
              aria-label="Opacity"
              min={0}
              max={1}
              step={0.05}
              value={[logo.opacity]}
              onValueChange={([v]) => update("logo.opacity", v)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
