import { db, json, readJson } from "../../_lib/auth.js";
import { authorize } from "../../_lib/admin.js";

const allowed = new Set(["pending", "approved", "rejected"]);

export async function POST(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  const body = await readJson(request);
  const userId = typeof body.userId === "string" ? body.userId : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !allowed.has(status)) return json({ error: "Invalid request." }, 400);
  try {
    const rows = await db()`UPDATE driver_profiles SET status = ${status} WHERE user_id = ${userId} RETURNING status`;
    if (!rows.length) return json({ error: "Driver not found." }, 404);
    return json({ ok: true, status });
  } catch (error) {
    console.error("driver status failed", error);
    return json({ error: "Could not update the driver." }, 500);
  }
}
