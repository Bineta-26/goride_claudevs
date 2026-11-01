import { clearCookie, currentUser, json, readSession } from "../_lib/auth.js";

export async function GET(request: Request): Promise<Response> {
  if (!readSession(request)) return json({ user: null });
  try {
    const user = await currentUser(request);
    return user ? json({ user }) : json({ user: null }, 200, { "set-cookie": clearCookie });
  } catch (error) {
    console.error("me failed", error);
    return json({ error: "Could not load your account." }, 500);
  }
}
