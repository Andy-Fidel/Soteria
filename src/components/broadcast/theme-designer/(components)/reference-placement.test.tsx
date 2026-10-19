// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it } from "vitest"
import { ReferencePlacement } from "./reference-placement"
import { useBroadcastStore } from "@/stores/broadcast-store"
import { BUILTIN_THEMES } from "@/lib/builtin-themes"

it("offers six fixed positions and preserves the edge margin", async () => {
  const initial = useBroadcastStore.getState()
  const theme = structuredClone(BUILTIN_THEMES[1])
  theme.reference.standalone = { anchor: "bottom-center", margin: 96 }
  useBroadcastStore.setState({ draftTheme: theme })
  const container = document.createElement("div")
  const root = createRoot(container)
  try {
    await act(async () => root.render(<ReferencePlacement />))
    expect(container.querySelectorAll("button")).toHaveLength(6)
    await act(async () =>
      (
        container.querySelector(
          '[aria-label="Reference top center"]'
        ) as HTMLButtonElement
      ).click()
    )
    expect(
      useBroadcastStore.getState().draftTheme!.reference.standalone
    ).toEqual({ anchor: "top-center", margin: 96 })
    expect(
      container
        .querySelector('[aria-label="Reference top center"]')!
        .getAttribute("aria-pressed")
    ).toBe("true")
  } finally {
    await act(async () => root.unmount())
    useBroadcastStore.setState(initial, true)
  }
})
