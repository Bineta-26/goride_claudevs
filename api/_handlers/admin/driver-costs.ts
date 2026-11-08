import { db, json, readJson } from "../../_lib/auth.js";
import { authorize } from "../../_lib/admin.js";

/*
 * Monthly fuel and maintenance costs that the admin enters for each driver.
 * driver_key is either a driver's user id or a sample-driver key ("sample-01"), so it is plain text.
 */

let ready: Promise<unknown> | null = null;
function ensureTable() {
  ready ??= db()`CREATE TABLE IF NOT EXISTS driver_costs (
    driver_key text NOT NULL,
    month text NOT NULL,
    fuel numeric(10,2) NOT NULL DEFAULT 0,
    maintenance numeric(10,2) NOT NULL DEFAULT 0,
    note text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (driver_key, month)
  )`.catch((e) => { ready = null; throw e; });
  return ready;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const KEY = /^[A-Za-z0-9-]{1,64}$/;
const money = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000 ? Math.round(n * 100) / 100 : null;
};

/** All cost entries for one month: ?month=YYYY-MM */
export async function GET(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!MONTH.test(month)) return json({ error: "Invalid month." }, 400);
  try {
    await ensureTable();
    const rows = await db()`SELECT driver_key, fuel, maintenance, note, updated_at FROM driver_costs WHERE month = ${month}`;
    const costs = Object.fromEntries((rows as Record<string, any>[]).map((r) => [r.driver_key, { fuel: Number(r.fuel), maintenance: Number(r.maintenance), note: r.note ?? "", updatedAt: new Date(r.updated_at).toISOString() }]));
    return json({ costs });
  } catch (error) {
    console.error("driver costs load failed", error);
    return json({ error: "Could not load driver costs." }, 500);
  }
}

/** Save (or replace) one driver's costs for one month. */
export async function POST(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  const body = await readJson(request);
  const driverKey = typeof body.driverKey === "string" ? body.driverKey : "";
  const month = typeof body.month === "string" ? body.month : "";
  const fuel = money(body.fuel);
  const maintenance = money(body.maintenance);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
  if (!KEY.test(driverKey) || !MONTH.test(month)) return json({ error: "Invalid request." }, 400);
  if (fuel === null || maintenance === null) return json({ error: "Enter amounts in AED (0 or more)." }, 400);
  try {
    await ensureTable();
    await db()`INSERT INTO driver_costs (driver_key, month, fuel, maintenance, note)
      VALUES (${driverKey}, ${month}, ${fuel}, ${maintenance}, ${note})
      ON CONFLICT (driver_key, month) DO UPDATE SET fuel = EXCLUDED.fuel, maintenance = EXCLUDED.maintenance, note = EXCLUDED.note, updated_at = now()`;
    return json({ ok: true });
  } catch (error) {
    console.error("driver costs save failed", error);
    return json({ error: "Could not save the costs." }, 500);
  }
}

/** Remove an entry so the dashboard falls back to the estimate. ?driverKey=&month= */
export async function DELETE(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const driverKey = params.get("driverKey") ?? "";
  const month = params.get("month") ?? "";
  if (!KEY.test(driverKey) || !MONTH.test(month)) return json({ error: "Invalid request." }, 400);
  try {
    await ensureTable();
    await db()`DELETE FROM driver_costs WHERE driver_key = ${driverKey} AND month = ${month}`;
    return json({ ok: true });
  } catch (error) {
    console.error("driver costs delete failed", error);
    return json({ error: "Could not clear the costs." }, 500);
  }
}
