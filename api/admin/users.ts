import { db, ensureSchema, hashPassword, json, parseAccount, readJson } from "../_lib/auth.js";
import { authorize } from "../_lib/admin.js";

const UUID = /^[0-9a-f-]{36}$/i;
const DUPLICATE = "Another account already uses this email address.";

/** List every account. */
export async function GET(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const rows = await db()`SELECT u.id, u.role, u.full_name, u.email, u.phone, u.created_at, u.suspended,
        d.vehicle, d.plate_number, d.license_number, d.status
      FROM users u LEFT JOIN driver_profiles d ON d.user_id = u.id
      ORDER BY u.created_at DESC LIMIT 1000`;
    const users = (rows as Record<string, any>[]).map((r) => ({
      id: r.id, role: r.role, fullName: r.full_name, email: r.email, phone: r.phone, createdAt: new Date(r.created_at).toISOString(), suspended: !!r.suspended,
      driver: r.role === "driver" && r.vehicle ? { vehicle: r.vehicle, plateNumber: r.plate_number, licenseNumber: r.license_number, status: r.status } : null,
    }));
    return json({ users });
  } catch (error) {
    console.error("admin users failed", error);
    return json({ error: "Could not load accounts." }, 500);
  }
}

/** Add an account (admin chooses a temporary password). Drivers added by an admin are approved straight away. */
export async function POST(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  const body = await readJson(request);
  const parsed = parseAccount(body);
  if ("error" in parsed) return json({ error: parsed.error }, 400);
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 200) return json({ error: "The temporary password needs at least 8 characters." }, 400);
  const a = parsed.value;
  try {
    await ensureSchema();
    const sql = db();
    if ((await sql`SELECT 1 FROM users WHERE email = ${a.email}`).length) return json({ error: DUPLICATE }, 409);
    const hash = await hashPassword(password);
    const inserted = await sql`INSERT INTO users (role, full_name, email, phone, password_hash)
      VALUES (${a.role}, ${a.fullName}, ${a.email}, ${a.phone}, ${hash}) RETURNING id`;
    const id = (inserted[0] as { id: string }).id;
    if (a.role === "driver") {
      await sql`INSERT INTO driver_profiles (user_id, vehicle, plate_number, license_number, status)
        VALUES (${id}, ${a.vehicle}, ${a.plateNumber}, ${a.licenseNumber}, 'approved')`;
    }
    return json({ ok: true, id }, 201);
  } catch (error) {
    console.error("admin create failed", error);
    if (String(error).includes("users_email_key")) return json({ error: DUPLICATE }, 409);
    return json({ error: "Could not create the account." }, 500);
  }
}

/** Edit an account's details (the account type cannot be changed). */
export async function PATCH(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  const body = await readJson(request);
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!UUID.test(userId)) return json({ error: "Invalid account." }, 400);
  try {
    await ensureSchema();
    const sql = db();
    const current = await sql`SELECT role FROM users WHERE id = ${userId}`;
    if (!current.length) return json({ error: "Account not found." }, 404);
    const parsed = parseAccount({ ...body, role: (current[0] as { role: string }).role });
    if ("error" in parsed) return json({ error: parsed.error }, 400);
    const a = parsed.value;
    if ((await sql`SELECT 1 FROM users WHERE email = ${a.email} AND id <> ${userId}`).length) return json({ error: DUPLICATE }, 409);
    await sql`UPDATE users SET full_name = ${a.fullName}, email = ${a.email}, phone = ${a.phone} WHERE id = ${userId}`;
    if (a.role === "driver") {
      await sql`INSERT INTO driver_profiles (user_id, vehicle, plate_number, license_number)
        VALUES (${userId}, ${a.vehicle}, ${a.plateNumber}, ${a.licenseNumber})
        ON CONFLICT (user_id) DO UPDATE SET vehicle = EXCLUDED.vehicle, plate_number = EXCLUDED.plate_number, license_number = EXCLUDED.license_number`;
    }
    return json({ ok: true });
  } catch (error) {
    console.error("admin edit failed", error);
    if (String(error).includes("users_email_key")) return json({ error: DUPLICATE }, 409);
    return json({ error: "Could not save the changes." }, 500);
  }
}

/** Permanently delete an account (driver details are removed with it). */
export async function DELETE(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  const userId = new URL(request.url).searchParams.get("userId") ?? "";
  if (!UUID.test(userId)) return json({ error: "Invalid account." }, 400);
  try {
    const rows = await db()`DELETE FROM users WHERE id = ${userId} RETURNING id`;
    if (!rows.length) return json({ error: "Account not found." }, 404);
    return json({ ok: true });
  } catch (error) {
    console.error("admin delete failed", error);
    return json({ error: "Could not delete the account." }, 500);
  }
}
