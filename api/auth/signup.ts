import { db, ensureSchema, hashPassword, isEmail, json, loadUser, readJson, sessionCookie, str, type Role } from "../_lib/auth.js";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await readJson(request);
    const role = str(body.role) as Role;
    const fullName = str(body.fullName, 120);
    const email = str(body.email, 200).toLowerCase();
    const phone = str(body.phone, 30) || null;
    const password = typeof body.password === "string" ? body.password : "";
    const vehicle = str(body.vehicle, 120);
    const plateNumber = str(body.plateNumber, 20).toUpperCase();
    const licenseNumber = str(body.licenseNumber, 40).toUpperCase();

    if (role !== "rider" && role !== "driver") return json({ error: "Choose whether you are signing up as a rider or a driver." }, 400);
    if (fullName.length < 2) return json({ error: "Please enter your full name." }, 400);
    if (!isEmail(email)) return json({ error: "Please enter a valid email address." }, 400);
    if (password.length < 8 || password.length > 200) return json({ error: "Your password needs at least 8 characters." }, 400);
    if (role === "driver" && (!vehicle || !plateNumber || !licenseNumber)) return json({ error: "Drivers need to add their vehicle, plate number and licence number." }, 400);

    await ensureSchema();
    const sql = db();
    const existing = await sql`SELECT 1 FROM users WHERE email = ${email}`;
    if (existing.length) return json({ error: "An account with this email already exists. Please log in instead." }, 409);

    const passwordHash = await hashPassword(password);
    const inserted = await sql`INSERT INTO users (role, full_name, email, phone, password_hash)
      VALUES (${role}, ${fullName}, ${email}, ${phone}, ${passwordHash}) RETURNING id`;
    const id = (inserted[0] as { id: string }).id;
    if (role === "driver") {
      await sql`INSERT INTO driver_profiles (user_id, vehicle, plate_number, license_number) VALUES (${id}, ${vehicle}, ${plateNumber}, ${licenseNumber})`;
    }
    const user = await loadUser(id);
    return json({ user }, 201, { "set-cookie": sessionCookie(id, role) });
  } catch (error) {
    console.error("signup failed", error);
    if (String(error).includes("users_email_key")) return json({ error: "An account with this email already exists. Please log in instead." }, 409);
    return json({ error: "We could not create your account right now. Please try again." }, 500);
  }
}
