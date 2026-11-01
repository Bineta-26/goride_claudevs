import { clearCookie, ensureSchema, json, loadUser, readSession } from "../_lib/auth.js";

export async function GET(request: Request): Promise<Response> {
  const session = readSession(request);
  if (!session) return json({ user: null });
  try {
    await ensureSchema();
    const user = await loadUser(session.uid);
    return user && !user.suspended ? json({ user }) : json({ user: null }, 200, { "set-cookie": clearCookie });
  } catch (error) {
    console.error("me failed", error);
    return json({ error: "Could not load your account." }, 500);
  }
}
