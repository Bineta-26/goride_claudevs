import { json, readJson } from "../../_lib/auth.js";
import { adminCookie, clearFailures, clientIp, credentialsMatch, isLaptopRequest, isLockedOut, keyMatches, notFound, recordFailure } from "../../_lib/admin.js";

export async function POST(request: Request): Promise<Response> {
  if (!keyMatches(request.headers.get("x-admin-key")) || !isLaptopRequest(request)) return notFound();
  const body = await readJson(request);
  const login = typeof body.login === "string" ? body.login.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passcode = typeof body.passcode === "string" ? body.passcode.trim() : "";
  const ip = clientIp(request);
  try {
    if (await isLockedOut(ip)) return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
    if (!credentialsMatch(login, password, passcode)) {
      await recordFailure(ip);
      return json({ error: "Those details are not correct." }, 401);
    }
    await clearFailures(ip);
    return json({ ok: true }, 200, { "set-cookie": adminCookie(), "x-robots-tag": "noindex, nofollow" });
  } catch (error) {
    console.error("admin login failed", error);
    return json({ error: "Sign-in is unavailable right now." }, 500);
  }
}
