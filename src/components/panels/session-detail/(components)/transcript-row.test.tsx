import { renderToStaticMarkup } from "react-dom/server"
import { load } from "cheerio"
import { expect, it } from "vitest"
import { TranscriptRow } from "./transcript-row"

const props = {
  segment: {
    id: 1,
    sessionId: 1,
    text: "Living by faith",
    timestampMs: 123000,
    isFinal: true,
    confidence: null,
    speakerLabel: null,
  },
  query: "faith",
  editMode: false,
  editing: false,
  draft: "",
  onStartEdit() {},
  onCancelEdit() {},
  onChangeDraft() {},
  onSaveEdit() {},
  onDelete() {},
}
it("makes timestamps visible and marks the active segment while keeping matching words", () => {
  const $ = load(
    renderToStaticMarkup(
      <TranscriptRow {...props} seconds={68} canSeek active />
    )
  )
  expect($("button").first().text()).toBe("01:08")
  expect($("[aria-current=true]")).toHaveLength(1)
  expect($("mark").text()).toBe("faith")
})
it("does not offer a broken seek action when no recording is available", () => {
  const $ = load(
    renderToStaticMarkup(
      <TranscriptRow {...props} seconds={68} canSeek={false} />
    )
  )
  expect($("button").first().attr("disabled")).toBeDefined()
})
