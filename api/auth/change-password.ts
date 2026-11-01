import { currentUser, db, json, passwordProblem, readJson, sessionCookie, setPassword, verifyPassword } from "../_lib/auth.js";

/** Signed-in riders and drivers change their own password. Other devices are signed out; this one stays signed in. */
export async function POST(request: Request): Promise<Response> {
  try {
    const user = await currentUser(request);
    if (!user) return json({ error: "Please log in again." }, 401);
    const body = await readJson(request);
    const current = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const next = body.newPassword;
    const problem = passwordProblem(next);
    if (problem) return json({ error: problem }, 400);
    if (current === next) return json({ error: "Choose a password different from your current one." }, 400);
    const rows = await db()`SELECT password_hash FROM users WHERE id = ${user.id}`;
    const hash = (rows[0] as { password_hash: string } | undefined)?.password_hash;
    if (!hash || !(await verifyPassword(current, hash))) return json({ error: "Your current password is not correct." }, 400);
    const version = await setPassword(user.id, next as string);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(user.id, user.role, version) });
  } catch (error) {
    console.error("change password failed", error);
    return json({ error: "Could not change your password right now." }, 500);
  }
}
