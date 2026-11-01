import { createHash } from "node:crypto";
import { db, ensureSchema, json, passwordProblem, readJson, setPassword } from "../../_lib/auth.js";

const INVALID = "This reset link is invalid or has expired. Please request a new one.";

export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);
  const token = typeof body.token === "string" ? body.token : "";
  const problem = passwordProblem(body.password);
  if (!token) return json({ error: INVALID }, 400);
  if (problem) return json({ error: problem }, 400);
  try {
    await ensureSchema();
    const hash = createHash("sha256").update(token).digest("hex");
    // Mark the token used in the same statement that checks it, so it can only ever work once.
    const rows = await db()`UPDATE password_resets SET used_at = now()
      WHERE token_hash = ${hash} AND used_at IS NULL AND expires_at > now() RETURNING user_id`;
    const userId = (rows[0] as { user_id: string } | undefined)?.user_id;
    if (!userId) return json({ error: INVALID }, 400);
    await setPassword(userId, body.password as string);
    await db()`UPDATE password_resets SET used_at = now() WHERE user_id = ${userId} AND used_at IS NULL`;
    return json({ ok: true });
  } catch (error) {
    console.error("reset password failed", error);
    return json({ error: "We could not reset your password right now. Please try again." }, 500);
  }
}
