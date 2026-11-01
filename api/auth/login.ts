import { db, ensureSchema, json, loadUser, readJson, sessionCookie, str, verifyPassword, type Role } from "../_lib/auth.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const email = str(body.email, 200).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) return json({ error: "Enter your email and password." }, 400);
    await ensureSchema();
    const rows = await db()`SELECT id, role, password_hash FROM users WHERE email = ${email}`;
    const row = rows[0] as { id: string; role: Role; password_hash: string } | undefined;
    if (!row || !(await verifyPassword(password, row.password_hash))) return json({ error: "Email or password is incorrect." }, 401);
    const user = await loadUser(row.id);
    return json({ user }, 200, { "set-cookie": sessionCookie(row.id, row.role) });
  } catch (error) {
    console.error("login failed", error);
    return json({ error: "We could not sign you in right now. Please try again." }, 500);
  }
}
