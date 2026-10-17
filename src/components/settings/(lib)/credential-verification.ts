export type VerifyState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; detail: string }
  | { status: "fail"; detail: string }
export type VerifyResult = {
  ok: boolean
  http_ok: boolean
  ws_ok: boolean
  detail: string
}
