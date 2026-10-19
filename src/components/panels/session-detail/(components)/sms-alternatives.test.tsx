// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
import { SmsAlternatives } from "./sms-alternatives"
import type { SmsAlternative } from "../(lib)/sms-alternatives"
it("selects an exact option without sending and shows character counts", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const container = document.createElement("div")
  const root = createRoot(container)
  const onSelect = vi.fn()
  const options: SmsAlternative[] = [
    { approach: "encouragement", message: "God values your obedience." },
    { approach: "reflection", message: "What holds you back?" },
    { approach: "action", message: "Choose obedience today." },
  ]
  try {
    await act(async () =>
      root.render(
        <SmsAlternatives
          options={options}
          selectedMessage={options[0].message}
          disabled={false}
          onSelect={onSelect}
        />
      )
    )
    const buttons = container.querySelectorAll("button")
    expect(buttons).toHaveLength(3)
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true")
    expect(buttons[1].textContent).toContain("/160")
    await act(async () => buttons[1].click())
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(options[1].message)
  } finally {
    await act(async () => root.unmount())
  }
})
