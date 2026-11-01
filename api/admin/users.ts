import { db, ensureSchema, json } from "../_lib/auth.js";
import { authorize } from "../_lib/admin.js";

export async function GET(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    await ensureSchema();
    const rows = await db()`SELECT u.id, u.role, u.full_name, u.email, u.phone, u.created_at,
        d.vehicle, d.plate_number, d.license_number, d.status
      FROM users u LEFT JOIN driver_profiles d ON d.user_id = u.id
      ORDER BY u.created_at DESC LIMIT 1000`;
    const users = (rows as Record<string, any>[]).map((r) => ({
      id: r.id, role: r.role, fullName: r.full_name, email: r.email, phone: r.phone, createdAt: new Date(r.created_at).toISOString(),
      driver: r.role === "driver" && r.vehicle ? { vehicle: r.vehicle, plateNumber: r.plate_number, licenseNumber: r.license_number, status: r.status } : null,
    }));
    return json({ users });
  } catch (error) {
    console.error("admin users failed", error);
    return json({ error: "Could not load accounts." }, 500);
  }
}
