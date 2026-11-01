import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { db, json } from "./auth.js";

/*
 * Hidden admin portal.
 * Everything secret lives in Vercel environment variables, never in this (public) repository:
 *   ADMIN_URL_KEY   – the secret part of the admin URL: /admin/<ADMIN_URL_KEY>
 *   ADMIN_LOGIN     – admin username
 *   ADMIN_PASSWORD  – admin password
 *   ADMIN_PASSCODE  – extra passcode (second factor)
 * If any is missing, the portal behaves exactly like a page that does not exist.
 */

const COOKIE = "goride_admin";
const MAX_AGE = 60 * 60 * 8; // 8 hours
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

const env = (name: string) => (process.env[name] ?? "").trim();

export function adminConfigured() {
  return env("ADMIN_URL_KEY").length >= 16 && !!env("ADMIN_LOGIN") && env("ADMIN_PASSWORD").length >= 10 && env("ADMIN_PASSCODE").length >= 6;
}

/** Constant-time comparison that also hides length differences. */
export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a.length === b.length;
}

const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod|Tablet|Silk|Kindle|PlayBook|BlackBerry|BB10|Opera Mini|IEMobile|webOS/i;
export function isLaptopRequest(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  const chMobile = request.headers.get("sec-ch-ua-mobile");
  return !!ua && !MOBILE_UA.test(ua) && chMobile !== "?1";
}

export function keyMatches(key: string | null | undefined) {
  return adminConfigured() && typeof key === "string" && safeEqual(key, env("ADMIN_URL_KEY"));
}

/** Same response a random unknown URL gets — reveals nothing. */
export const notFound = () => json({ error: "Not found" }, 404, { "x-robots-tag": "noindex, nofollow" });

function secret() {
  return createHash("sha256").update(`goride-admin:${env("ADMIN_URL_KEY")}:${env("ADMIN_PASSWORD")}:${env("ADMIN_PASSCODE")}:${process.env.SESSION_SECRET ?? ""}`).digest("hex");
}
const sign = (value: string) => createHmac("sha256", secret()).update(value).digest("base64url");

export function adminCookie() {
  const payload = Buffer.from(JSON.stringify({ admin: true, exp: Math.floor(Date.now() / 1000) + MAX_AGE })).toString("base64url");
  return `${COOKIE}=${payload}.${sign(payload)}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE}`;
}
export const clearAdminCookie = `${COOKIE}=; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

function hasAdminSession(request: Request) {
  const raw = (request.headers.get("cookie") ?? "").split(/;\s*/).find((p) => p.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!raw) return false;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp > Date.now() / 1000; } catch { return false; }
}

/** Gate for every protected admin endpoint: secret URL key + laptop + signed admin session. */
export function authorize(request: Request): Response | null {
  if (!keyMatches(request.headers.get("x-admin-key")) || !isLaptopRequest(request)) return notFound();
  if (!hasAdminSession(request)) return json({ error: "Please sign in again." }, 401, { "x-robots-tag": "noindex, nofollow" });
  return null;
}

export function clientIp(request: Request) {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "unknown";
}

let attemptsReady: Promise<unknown> | null = null;
function ensureAttempts() {
  attemptsReady ??= db()`CREATE TABLE IF NOT EXISTS admin_login_attempts (ip text NOT NULL, at timestamptz NOT NULL DEFAULT now())`.catch((e) => { attemptsReady = null; throw e; });
  return attemptsReady;
}
export async function isLockedOut(ip: string) {
  await ensureAttempts();
  const rows = await db()`SELECT count(*)::int AS n FROM admin_login_attempts WHERE ip = ${ip} AND at > now() - make_interval(mins => ${LOCK_MINUTES})`;
  return ((rows[0] as { n: number })?.n ?? 0) >= MAX_FAILS;
}
export async function recordFailure(ip: string) {
  await ensureAttempts();
  await db()`INSERT INTO admin_login_attempts (ip) VALUES (${ip})`;
  await db()`DELETE FROM admin_login_attempts WHERE at < now() - interval '1 day'`;
}
export async function clearFailures(ip: string) {
  await ensureAttempts();
  await db()`DELETE FROM admin_login_attempts WHERE ip = ${ip}`;
}

export function credentialsMatch(login: string, password: string, passcode: string) {
  // Evaluate all three so timing does not reveal which one was wrong.
  const a = safeEqual(login, env("ADMIN_LOGIN"));
  const b = safeEqual(password, env("ADMIN_PASSWORD"));
  const c = safeEqual(passcode, env("ADMIN_PASSCODE"));
  return a && b && c;
}
