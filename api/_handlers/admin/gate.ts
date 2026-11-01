import { json } from "../../_lib/auth.js";
import { isLaptopRequest, keyMatches, notFound } from "../../_lib/admin.js";

// Confirms the secret admin URL. Anything wrong looks like a missing page.
export function GET(request: Request): Response {
  const key = new URL(request.url).searchParams.get("key");
  if (!keyMatches(key)) return notFound();
  if (!isLaptopRequest(request)) return notFound();
  return json({ ok: true }, 200, { "x-robots-tag": "noindex, nofollow" });
}
