import { neon } from "@neondatabase/serverless";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export type Role = "rider" | "driver";
export type PublicUser = {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  suspended: boolean;
  driver?: { vehicle: string; plateNumber: string; licenseNumber: string; status: string } | null;
};

function databaseUrl(): string {
  const url = process.env.GORIDE_DB_DATABASE_URL || process.env.GORIDE_DB_POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Database is not configured (GORIDE_DB_DATABASE_URL missing).");
  return url;
}

export function db() { return neon(databaseUrl()); }

let schemaReady: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    const sql = db();
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        role text NOT NULL CHECK (role IN ('rider','driver')),
        full_name text NOT NULL,
        email text NOT NULL UNIQUE,
        phone text,
        password_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false`;
      await sql`CREATE TABLE IF NOT EXISTS driver_profiles (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        vehicle text NOT NULL,
        plate_number text NOT NULL,
        license_number text NOT NULL,
        status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
    })().catch((error) => { schemaReady = null; throw error; });
  }
  return schemaReady;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const COOKIE = "goride_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret(): string {
  return process.env.SESSION_SECRET || createHash("sha256").update(`goride-session:${databaseUrl()}`).digest("hex");
}
function sign(value: string) { return createHmac("sha256", secret()).update(value).digest("base64url"); }

export function sessionCookie(userId: string, role: Role): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, role, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`;
}
export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function readSession(request: Request): { uid: string; role: Role } | null {
  const cookie = request.headers.get("cookie") ?? "";
  const raw = cookie.split(/;\s*/).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.uid !== "string" || data.exp < Date.now() / 1000) return null;
    return { uid: data.uid, role: data.role };
  } catch { return null; }
}

export async function loadUser(id: string): Promise<PublicUser | null> {
  const sql = db();
  const rows = await sql`SELECT u.id, u.role, u.full_name, u.email, u.phone, u.created_at, u.suspended,
      d.vehicle, d.plate_number, d.license_number, d.status
    FROM users u LEFT JOIN driver_profiles d ON d.user_id = u.id WHERE u.id = ${id}`;
  const r = rows[0] as Record<string, any> | undefined;
  if (!r) return null;
  return {
    id: r.id, role: r.role, fullName: r.full_name, email: r.email, phone: r.phone, createdAt: new Date(r.created_at).toISOString(), suspended: !!r.suspended,
    driver: r.role === "driver" && r.vehicle ? { vehicle: r.vehicle, plateNumber: r.plate_number, licenseNumber: r.license_number, status: r.status } : null,
  };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", ...headers } });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try { const body = await request.json(); return body && typeof body === "object" ? body as Record<string, unknown> : {}; } catch { return {}; }
}

export const str = (value: unknown, max = 200) => (typeof value === "string" ? value.trim().slice(0, max) : "");
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

export type AccountInput = { role: Role; fullName: string; email: string; phone: string | null; vehicle: string; plateNumber: string; licenseNumber: string };

/** Reads and validates account fields shared by sign-up and the admin screen. Returns an error message or the clean values. */
export function parseAccount(body: Record<string, unknown>): { error: string } | { value: AccountInput } {
  const role = str(body.role) as Role;
  const value: AccountInput = {
    role,
    fullName: str(body.fullName, 120),
    email: str(body.email, 200).toLowerCase(),
    phone: str(body.phone, 30) || null,
    vehicle: str(body.vehicle, 120),
    plateNumber: str(body.plateNumber, 20).toUpperCase(),
    licenseNumber: str(body.licenseNumber, 40).toUpperCase(),
  };
  if (role !== "rider" && role !== "driver") return { error: "Choose whether the account is for a rider or a driver." };
  if (value.fullName.length < 2) return { error: "Please enter the full name." };
  if (!isEmail(value.email)) return { error: "Please enter a valid email address." };
  if (role === "driver" && (!value.vehicle || !value.plateNumber || !value.licenseNumber)) return { error: "Drivers need a vehicle, plate number and licence number." };
  return { value };
}
