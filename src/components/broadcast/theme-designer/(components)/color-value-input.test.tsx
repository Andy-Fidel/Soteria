// @vitest-environment jsdom
import { act } from "react"
import { createRoot } from "react-dom/client"
import { expect, it, vi } from "vitest"
import { ColorValueInput } from "./color-value-input"

it("accepts incomplete typing and commits only a complete color on blur", async () => {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container),
    onValueChange = vi.fn()
  await act(async () =>
    root.render(
      <ColorValueInput value="#ffffff" onValueChange={onValueChange} />
    )
  )
  const input = container.querySelector("input")!
  const set = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )!.set!
  await act(async () => {
    input.focus()
    set.call(input, "#12")
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
  expect(input.value).toBe("#12")
  expect(onValueChange).not.toHaveBeenCalled()
  await act(async () => {
    set.call(input, "#123456")
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.blur()
  })
  expect(onValueChange).toHaveBeenCalledWith("#123456")
  await act(async () => root.unmount())
  container.remove()
})
