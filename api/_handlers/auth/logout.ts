import { clearCookie, json } from "../../_lib/auth.js";

export function POST(): Response {
  return json({ ok: true }, 200, { "set-cookie": clearCookie });
}
