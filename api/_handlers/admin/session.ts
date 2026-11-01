import { json } from "../../_lib/auth.js";
import { authorize, clearAdminCookie, isLaptopRequest, keyMatches, notFound } from "../../_lib/admin.js";

export function GET(request: Request): Response {
  return authorize(request) ?? json({ admin: true });
}

export function DELETE(request: Request): Response {
  if (!keyMatches(request.headers.get("x-admin-key")) || !isLaptopRequest(request)) return notFound();
  return json({ ok: true }, 200, { "set-cookie": clearAdminCookie });
}
