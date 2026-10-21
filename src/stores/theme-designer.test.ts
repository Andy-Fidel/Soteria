import { beforeEach, describe, expect, it, vi } from "vitest"
const { invoke, emit } = vi.hoisted(() => ({ invoke: vi.fn(), emit: vi.fn() }))
vi.mock("@tauri-apps/api/core", () => ({
  invoke,
  convertFileSrc: (p: string) => p,
}))
vi.mock("@tauri-apps/api/event", () => ({ emit }))

describe("theme designer save and draft safety", () => {
  beforeEach(() => {
    vi.resetModules()
    invoke.mockReset().mockResolvedValue(undefined)
    emit.mockReset().mockResolvedValue(undefined)
  })
  it("keeps a failed save out of the library and preserves the draft", async () => {
    const { useBroadcastStore: store } = await import("./broadcast-store")
    const first = store.getState().themes[0]
    store.getState().startEditing(first.id)
    store.getState().updateDraftNested("verseText.fontSize", 85)
    invoke.mockRejectedValueOnce(new Error("Disk full"))
    await expect(store.getState().saveDraft()).rejects.toThrow("Disk full")
    expect(store.getState().themes).toHaveLength(6)
    expect(store.getState().draftTheme?.verseText.fontSize).toBe(85)
    expect(store.getState().activeThemeId).toBe(first.id)
  })
  it("saving a new theme does not change output; saving an applied theme syncs it", async () => {
    const { useBroadcastStore: store } = await import("./broadcast-store")
    const first = store.getState().themes[0]
    store.getState().startEditing(first.id)
    await store.getState().saveDraft()
    const custom = store.getState().draftTheme!
    expect(store.getState().activeThemeId).toBe(first.id)
    expect(emit).not.toHaveBeenCalled()
    store.getState().setActiveTheme(custom.id)
    store.getState().setAltActiveTheme(custom.id)
    emit.mockClear()
    store.getState().updateDraftNested("verseText.fontSize", 80)
    await store.getState().saveDraft()
    for (const output of ["main", "alt"])
      expect(emit).toHaveBeenCalledWith(
        `broadcast:verse-update:${output}`,
        expect.objectContaining({
          theme: expect.objectContaining({
            verseText: expect.objectContaining({ fontSize: 80 }),
          }),
        })
      )
  })
  it("opens the active theme, keeps new themes out of the library, and supports undo", async () => {
    const { useBroadcastStore: store } = await import("./broadcast-store")
    const active = store.getState().themes[2]
    store.getState().setActiveTheme(active.id)
    store.getState().setDesignerOpen(true)
    expect(store.getState().editingThemeId).toBe(active.id)
    store.getState().duplicateTheme(active.id)
    expect(store.getState().themes).toHaveLength(6)
    store.getState().updateDraftNested("verseText.fontSize", 81)
    store.getState().undoDraft()
    expect(store.getState().draftTheme?.verseText.fontSize).toBe(
      active.verseText.fontSize
    )
    store.getState().redoDraft()
    expect(store.getState().draftTheme?.verseText.fontSize).toBe(81)
  })
  it("rejects stale uploads and malformed stored themes", async () => {
    const { useBroadcastStore: store, hydrateCustomThemes } =
      await import("./broadcast-store")
    const [a, b] = store.getState().themes
    store.getState().startEditing(a.id)
    store.getState().startEditing(b.id)
    store
      .getState()
      .updateDraftAsset(a.id, "logo.url", "data:image/png;base64,late")
    expect(store.getState().draftTheme?.logo).toBeNull()
    invoke.mockResolvedValueOnce([
      ["bad", "Bad", "{}"],
      ["null", "Null", "null"],
    ])
    await hydrateCustomThemes()
    expect(store.getState().themes).toHaveLength(6)
  })
})

it("keeps deletion failures reversible and falls back on both outputs after deletion", async () => {
  vi.resetModules()
  invoke.mockReset().mockResolvedValue(undefined)
  emit.mockReset().mockResolvedValue(undefined)
  const { useBroadcastStore: store } = await import("./broadcast-store")
  store.getState().startEditing(store.getState().themes[0].id)
  await store.getState().saveDraft()
  const id = store.getState().draftTheme!.id
  store.getState().setActiveTheme(id)
  store.getState().setAltActiveTheme(id)
  invoke.mockRejectedValueOnce(new Error("Disk unavailable"))
  await expect(store.getState().deleteTheme(id)).rejects.toThrow()
  expect(store.getState().themes.some((t) => t.id === id)).toBe(true)
  await store.getState().deleteTheme(id)
  expect(store.getState().activeThemeId).toBe(store.getState().themes[0].id)
  expect(store.getState().altActiveThemeId).toBe(store.getState().themes[0].id)
})
