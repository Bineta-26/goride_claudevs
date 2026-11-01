import { createHash, randomBytes } from "node:crypto";
import { db, ensureSchema, isEmail, json, readJson, str } from "../../_lib/auth.js";
import { resetEmail, sendEmail } from "../../_lib/email.js";

// Always answers the same way, so nobody can use this form to discover which emails have accounts.
const DONE = { ok: true, message: "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder." };

export async function POST(request: Request): Promise<Response> {
  const email = str((await readJson(request)).email, 200).toLowerCase();
  if (!isEmail(email)) return json({ error: "Please enter a valid email address." }, 400);
  try {
    await ensureSchema();
    const sql = db();
    const rows = await sql`SELECT id, full_name, suspended FROM users WHERE email = ${email}`;
    const user = rows[0] as { id: string; full_name: string; suspended: boolean } | undefined;
    if (!user || user.suspended) return json(DONE);
    const recent = await sql`SELECT count(*)::int AS n FROM password_resets WHERE user_id = ${user.id} AND created_at > now() - interval '1 hour'`;
    if (((recent[0] as { n: number })?.n ?? 0) >= 3) return json(DONE);
    const token = randomBytes(32).toString("base64url");
    const hash = createHash("sha256").update(token).digest("hex");
    await sql`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (${hash}, ${user.id}, now() + interval '1 hour')`;
    await sql`DELETE FROM password_resets WHERE expires_at < now() - interval '1 day'`;
    const base = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
    const mail = resetEmail(user.full_name, `${base}/reset-password?token=${token}`);
    await sendEmail(email, mail.subject, mail.html, mail.text);
    return json(DONE);
  } catch (error) {
    console.error("forgot password failed", error);
    return json({ error: "We could not process the request right now. Please try again." }, 500);
  }
}
