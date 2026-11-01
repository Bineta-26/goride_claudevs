import { db, ensureSchema, json, readJson } from "../_lib/auth.js";
import { authorize } from "../_lib/admin.js";

/** Suspend or reactivate an account. Suspended people cannot log in and are signed out on their next page load. */
export async function POST(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  const body = await readJson(request);
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!/^[0-9a-f-]{36}$/i.test(userId) || typeof body.suspended !== "boolean") return json({ error: "Invalid request." }, 400);
  try {
    await ensureSchema();
    const rows = await db()`UPDATE users SET suspended = ${body.suspended} WHERE id = ${userId} RETURNING suspended`;
    if (!rows.length) return json({ error: "Account not found." }, 404);
    return json({ ok: true, suspended: body.suspended });
  } catch (error) {
    console.error("account status failed", error);
    return json({ error: "Could not update the account." }, 500);
  }
}
