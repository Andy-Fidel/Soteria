import { describe, expect, it } from "vitest"
import { joinRecap, splitRecap } from "./recap-sections"

describe("recap sections", () => {
  it("keeps older recaps unchanged and does not mistake prose for headings", () => {
    const message = "Prayer helps us grow.\n\nPractical response: Trust God."
    expect(splitRecap(message)).toEqual({ message, reflection: "", prayer: "" })
  })
  it("separates generated headings and older inline labels", () => {
    expect(splitRecap("Teaching.\n\nReflection: What will change?\n\nPrayer:\nLord, help me.")).toEqual({
      message: "Teaching.", reflection: "What will change?", prayer: "Lord, help me.",
    })
  })
  it("preserves spaces, line breaks and empty fields while editing", () => {
    const sections = { message: "Teaching.\n", reflection: "What ", prayer: "" }
    expect(splitRecap(joinRecap(sections))).toEqual(sections)
  })
})
