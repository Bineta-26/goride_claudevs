import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, BadgeCheck, CarFront, Clock3, Fuel, Gauge, LoaderCircle, MapPin, Phone, Route, Save, Settings2, Star, TrendingUp, Undo2, Wallet, Wrench, X } from "lucide-react";
import DriverMap, { usingGoogleMaps } from "./DriverMap";
import {
  DEFAULT_KPI, aed, emptyMonth, estimatedCosts, livePosition, monthKey, monthLabel, recentMonths, sampleDrivers, sampleMonth, summarise, tierLabel,
  type Costs, type KpiSettings, type MonthStats, type SampleDriver,
} from "./fleetData";

type Api = (path: string, init?: RequestInit) => Promise<Response>;
type AccountDriver = { id: string; fullName: string; email: string; phone: string | null; createdAt: string; suspended: boolean; driver: { vehicle: string; plateNumber: string; licenseNumber: string; status: string } | null };

type FleetDriver = {
  key: string; fullName: string; email: string; phone: string; vehicle: string; plateNumber: string; licenseNumber: string; joined: string;
  rating: number | null; sample: boolean; source?: SampleDriver;
};

const KPI_STORE = "goride-admin-kpi";
function loadKpi(): KpiSettings {
  try { const raw = localStorage.getItem(KPI_STORE); return raw ? { ...DEFAULT_KPI, ...JSON.parse(raw) } : DEFAULT_KPI; } catch { return DEFAULT_KPI; }
}
function saveKpi(k: KpiSettings) { try { localStorage.setItem(KPI_STORE, JSON.stringify(k)); } catch { /* storage unavailable */ } }

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
const hrs = (h: number) => `${Math.round(h).toLocaleString("en-AE")} h`;
const kms = (k: number) => `${Math.round(k).toLocaleString("en-AE")} km`;

export default function FleetView({ api, users, onSignedOut }: { api: Api; users: AccountDriver[]; onSignedOut: () => void }) {
  const months = useMemo(() => recentMonths(6), []);
  const [month, setMonth] = useState(months[0]);
  const [kpi, setKpi] = useState<KpiSettings>(loadKpi);
  const [showKpi, setShowKpi] = useState(false);
  const [entered, setEntered] = useState<Record<string, { fuel: number; maintenance: number; note: string; updatedAt?: string }>>({});
  const [costsError, setCostsError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 3000); return () => window.clearInterval(t); }, []);

  const apiRef = useRef(api); apiRef.current = api;
  const signedOutRef = useRef(onSignedOut); signedOutRef.current = onSignedOut;
  const loadCosts = useCallback(async () => {
    setCostsError("");
    try {
      const res = await apiRef.current(`driver-costs?month=${month}`);
      if (res.status === 401 || res.status === 404) { signedOutRef.current(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEntered(data.costs ?? {});
    } catch (e) { setEntered({}); setCostsError(e instanceof Error && e.message ? e.message : "Could not load driver costs."); }
  }, [month]);
  useEffect(() => { loadCosts(); }, [loadCosts]);

  const drivers: FleetDriver[] = useMemo(() => [
    ...users.filter((u) => u.driver && u.driver.status === "approved" && !u.suspended).map((u) => ({
      key: u.id, fullName: u.fullName, email: u.email, phone: u.phone ?? "—", vehicle: u.driver!.vehicle, plateNumber: u.driver!.plateNumber, licenseNumber: u.driver!.licenseNumber,
      joined: u.createdAt.slice(0, 10), rating: null, sample: false,
    })),
    ...sampleDrivers.map((d) => ({ key: d.key, fullName: d.fullName, email: d.email, phone: d.phone, vehicle: d.vehicle, plateNumber: d.plateNumber, licenseNumber: d.licenseNumber, joined: d.joined, rating: d.rating, sample: true, source: d })),
  ], [users]);

  const statsByKey = useMemo(() => {
    const map = new Map<string, MonthStats>();
    drivers.forEach((d) => map.set(d.key, d.source ? sampleMonth(d.source, month) : emptyMonth()));
    return map;
  }, [drivers, month]);

  const costsFor = (key: string): Costs => {
    const e = entered[key];
    return e ? { fuel: e.fuel, maintenance: e.maintenance, entered: true } : estimatedCosts(statsByKey.get(key) ?? emptyMonth(), kpi);
  };

  const rows = drivers.map((d) => {
    const stats = statsByKey.get(d.key) ?? emptyMonth();
    const costs = costsFor(d.key);
    const live = d.source ? livePosition(d.source, now) : null;
    return { d, stats, costs, live, s: summarise(stats, costs, kpi) };
  }).sort((a, b) => b.s.revenuePerHour - a.s.revenuePerHour);

  const totals = rows.reduce((t, r) => ({ km: t.km + r.stats.km, hours: t.hours + r.stats.hours, revenue: t.revenue + r.stats.revenue, cost: t.cost + r.s.totalCost, trips: t.trips + r.stats.tripCount }), { km: 0, hours: 0, revenue: 0, cost: 0, trips: 0 });
  const onlineCount = rows.filter((r) => r.live?.online).length;
  const fleetRph = totals.hours ? totals.revenue / totals.hours : 0;

  const mapDrivers = rows.filter((r) => r.live).map((r) => ({ key: r.d.key, name: r.d.fullName, position: r.live!.position, online: r.live!.online }));
  const current = rows.find((r) => r.d.key === selected);

  if (current) {
    return <DriverProfile
      row={current} month={month} months={months} setMonth={setMonth} kpi={kpi} now={now} api={api} onSignedOut={onSignedOut}
      savedAt={entered[current.d.key]?.updatedAt} note={entered[current.d.key]?.note ?? ""}
      onBack={() => setSelected(null)} onCostsChanged={loadCosts}
    />;
  }

  return <section className="fleet">
    <div className="fleet-head">
      <div><h2>Driver performance</h2><p>Live location, distance, hours and revenue for every approved driver. <span className="sample-tag">Sample data</span></p></div>
      <div className="fleet-head-actions">
        <select className="fleet-select" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">{months.map((m) => <option key={m} value={m}>{monthLabel(m)}{m === monthKey(new Date()) ? " (so far)" : ""}</option>)}</select>
        <button className="admin-btn" onClick={() => setShowKpi(true)}><Settings2 size={14} /> KPI settings</button>
      </div>
    </div>

    <div className="admin-stats fleet-stats">
      <div><small>Drivers online now</small><b>{onlineCount}<em>/ {drivers.length}</em></b></div>
      <div><small>Kilometres driven</small><b>{kms(totals.km)}</b></div>
      <div><small>Hours worked</small><b>{hrs(totals.hours)}</b></div>
      <div><small>Revenue for GoRide</small><b>{aed(totals.revenue)}</b></div>
      <div><small>Fleet revenue / hour</small><b className={`tier-text ${fleetRph >= kpi.target ? "target" : fleetRph >= kpi.breakEven ? "breakeven" : "below"}`}>AED {fleetRph.toFixed(1)}</b></div>
      <div><small>Profit after fuel &amp; maintenance</small><b>{aed(totals.revenue - totals.cost)}</b></div>
    </div>

    <KpiLegend kpi={kpi} />
    {costsError && <div className="auth-error" role="alert">{costsError} The table is using estimated costs.</div>}

    <div className="fleet-grid">
      <div className="fleet-map-card">
        <div className="fleet-card-head"><b><MapPin size={14} /> Where drivers are now</b><small>Click a pin to open a profile</small></div>
        <DriverMap drivers={mapDrivers} onSelect={setSelected} />
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table fleet-table">
          <thead><tr><th>Driver</th><th>Km</th><th>Hours</th><th>Revenue</th><th>Rev / hour</th><th>Fuel + maint.</th><th>Profit</th><th>KPI</th></tr></thead>
          <tbody>
            {rows.map(({ d, stats, costs, live, s }) => <tr key={d.key} className="fleet-row" onClick={() => setSelected(d.key)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setSelected(d.key); }}>
              <td><div className="fleet-person"><span className={`fleet-avatar ${live?.online ? "online" : ""}`}>{initials(d.fullName)}</span><span><b>{d.fullName}</b><small>{d.vehicle} · {d.plateNumber}</small></span></div></td>
              <td>{kms(stats.km)}</td>
              <td>{hrs(stats.hours)}</td>
              <td>{aed(stats.revenue)}</td>
              <td><b>{stats.hours ? `AED ${s.revenuePerHour.toFixed(1)}` : "—"}</b></td>
              <td>{aed(s.totalCost)}<small>{costs.entered ? "Entered" : "Estimate"}</small></td>
              <td className={s.profit < 0 ? "neg" : ""}>{aed(s.profit)}</td>
              <td><span className={`kpi-badge ${s.tier}`}>{tierLabel[s.tier]}</span></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
    {showKpi && <KpiModal kpi={kpi} onClose={() => setShowKpi(false)} onSave={(k) => { setKpi(k); saveKpi(k); setShowKpi(false); }} />}
  </section>;
}

function KpiLegend({ kpi }: { kpi: KpiSettings }) {
  return <div className="kpi-legend">
    <span className="kpi-badge below">Below AED {kpi.breakEven}/h</span>
    <span className="kpi-badge breakeven">AED {kpi.breakEven}–{kpi.target - 1}/h break-even</span>
    <span className="kpi-badge target">AED {kpi.target}–{kpi.excellent - 1}/h on target</span>
    <span className="kpi-badge excellent">AED {kpi.excellent}+/h excellent</span>
    <small>Fuel + maintenance should stay under {kpi.maxCostShare}% of revenue.</small>
  </div>;
}

type Row = { d: FleetDriver; stats: MonthStats; costs: Costs; live: ReturnType<typeof livePosition> | null; s: ReturnType<typeof summarise> };

function DriverProfile({ row, month, months, setMonth, kpi, now, api, onSignedOut, savedAt, note, onBack, onCostsChanged }: {
  row: Row; month: string; months: string[]; setMonth: (m: string) => void; kpi: KpiSettings; now: number; api: Api; onSignedOut: () => void;
  savedAt?: string; note: string; onBack: () => void; onCostsChanged: () => Promise<void>;
}) {
  const { d, stats, costs, live, s } = row;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true); setMsg(null);
    try {
      const res = await api("driver-costs", { method: "POST", body: JSON.stringify({ driverKey: d.key, month, fuel: form.fuel, maintenance: form.maintenance, note: form.note }) });
      if (res.status === 401 || res.status === 404) { onSignedOut(); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      await onCostsChanged();
      setMsg({ ok: true, text: `Costs saved for ${monthLabel(month)}.` });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error && e.message ? e.message : "Could not save the costs." }); }
    finally { setBusy(false); }
  };
  const clear = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await api(`driver-costs?driverKey=${encodeURIComponent(d.key)}&month=${month}`, { method: "DELETE" });
      if (res.status === 401 || res.status === 404) { onSignedOut(); return; }
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error);
      await onCostsChanged();
      setMsg({ ok: true, text: "Cleared. The dashboard is back to the estimate." });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error && e.message ? e.message : "Could not clear the costs." }); }
    finally { setBusy(false); }
  };

  const avgTripKm = stats.tripCount ? stats.paidKm / stats.tripCount : 0;
  const daysWorked = stats.daily.filter((x) => x.hours > 0).length;

  return <section className="fleet profile">
    <div className="fleet-head">
      <button className="admin-btn" onClick={onBack}><ArrowLeft size={14} /> All drivers</button>
      <select className="fleet-select" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">{months.map((m) => <option key={m} value={m}>{monthLabel(m)}{m === monthKey(new Date()) ? " (so far)" : ""}</option>)}</select>
    </div>

    <div className="profile-card">
      <span className={`fleet-avatar xl ${live?.online ? "online" : ""}`}>{initials(d.fullName)}</span>
      <div className="profile-id">
        <h2>{d.fullName} {d.sample && <span className="sample-tag">Sample driver</span>}</h2>
        <p><span><Phone size={13} /> {d.phone}</span><span>{d.email}</span><span><CarFront size={13} /> {d.vehicle} · {d.plateNumber}</span><span>Licence {d.licenseNumber}</span></p>
        <p><span>Joined {new Date(`${d.joined}T00:00:00`).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}</span>{d.rating && <span><Star size={13} /> {d.rating.toFixed(2)} rating</span>}<span className={live?.online ? "online-text" : "muted"}>{live ? (live.online ? "● Online now" : "○ Offline") : "No location shared yet"}</span></p>
      </div>
      <div className="profile-kpi"><span className={`kpi-badge big ${s.tier}`}><BadgeCheck size={14} /> {tierLabel[s.tier]}</span><b>{stats.hours ? `AED ${s.revenuePerHour.toFixed(1)}` : "—"}</b><small>revenue per hour · target AED {kpi.target}</small></div>
    </div>

    <div className="admin-stats fleet-stats">
      <div><small><Route size={12} /> Kilometres this month</small><b>{kms(stats.km)}</b><em>{kms(stats.paidKm)} with riders</em></div>
      <div><small><Clock3 size={12} /> Hours worked</small><b>{hrs(stats.hours)}</b><em>{daysWorked} days · {stats.tripCount} trips</em></div>
      <div><small><Wallet size={12} /> Revenue for GoRide</small><b>{aed(stats.revenue)}</b><em>AED {s.revenuePerKm.toFixed(2)} per km</em></div>
      <div><small><TrendingUp size={12} /> Profit after costs</small><b className={s.profit < 0 ? "neg" : ""}>{aed(s.profit)}</b><em>AED {s.profitPerHour.toFixed(1)} per hour</em></div>
    </div>

    <div className="profile-grid">
      <div className="fleet-map-card">
        <div className="fleet-card-head"><b><MapPin size={14} /> Live location</b><small>{live ? `Updated ${new Date(now).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Waiting for the driver app"}</small></div>
        {live ? <DriverMap drivers={[{ key: d.key, name: d.fullName, position: live.position, online: live.online, selected: true }]} focus={live.position} /> : <div className="fleet-map fleet-map-empty"><MapPin size={22} /><p>This driver has not shared a location yet. Their position appears here once they go online in the driver app.</p></div>}
        {live && <div className="coords">{live.position[0].toFixed(5)}, {live.position[1].toFixed(5)}{!usingGoogleMaps && " · add your Google Maps key to switch to Google Maps"}</div>}
      </div>

      <form className="cost-card admin-form" onSubmit={submit} key={`${d.key}-${month}-${costs.fuel}-${costs.maintenance}-${note}`}>
        <div className="fleet-card-head"><b><Fuel size={14} /> Costs for {monthLabel(month)}</b><small>{costs.entered ? `Saved${savedAt ? ` ${new Date(savedAt).toLocaleDateString("en-AE", { day: "numeric", month: "short" })}` : ""}` : "Not entered — showing estimate"}</small></div>
        <div className="auth-row">
          <label><span><Fuel size={12} /> Fuel (AED)</span><input name="fuel" type="number" min="0" step="0.01" required defaultValue={costs.entered ? costs.fuel : ""} placeholder={`Estimate ${costs.fuel}`} /></label>
          <label><span><Wrench size={12} /> Maintenance (AED)</span><input name="maintenance" type="number" min="0" step="0.01" required defaultValue={costs.entered ? costs.maintenance : ""} placeholder={`Estimate ${costs.maintenance}`} /></label>
        </div>
        <label><span>Note <em>(optional — e.g. tyres replaced)</em></span><input name="note" maxLength={300} defaultValue={note} /></label>
        <div className="cost-breakdown">
          <div><span>Revenue</span><b>{aed(stats.revenue)}</b></div>
          <div><span>Fuel + maintenance</span><b>− {aed(s.totalCost)}</b></div>
          <div className="total"><span>Profit</span><b className={s.profit < 0 ? "neg" : ""}>{aed(s.profit)}</b></div>
          <div><span>Cost per km</span><b>AED {s.costPerKm.toFixed(2)}</b></div>
          <div><span>Costs as share of revenue</span><b className={s.costOk ? "ok" : "neg"}>{s.costShare}% {s.costOk ? "✓" : `(over ${kpi.maxCostShare}%)`}</b></div>
        </div>
        {msg && <div className={msg.ok ? "admin-notice" : "auth-error"} role="status">{msg.text}</div>}
        <div className="admin-modal-actions">
          {costs.entered && <button type="button" className="admin-btn" disabled={busy} onClick={clear}><Undo2 size={14} /> Use estimate</button>}
          <button className="admin-btn primary" disabled={busy}>{busy ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />} Save costs</button>
        </div>
      </form>
    </div>

    <div className="profile-grid">
      <div className="fleet-chart-card">
        <div className="fleet-card-head"><b><Gauge size={14} /> Daily revenue</b><small>{monthLabel(month)}</small></div>
        {stats.daily.length ? <ResponsiveContainer width="100%" height={220}>
          <BarChart data={stats.daily} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1ee" />
            <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#8a958f" }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#8a958f" }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v: number, name) => [name === "revenue" ? `AED ${v}` : `${v} h`, name === "revenue" ? "Revenue" : "Hours"]} />
            <Bar dataKey="revenue" fill="#10865e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer> : <p className="muted fleet-empty-text">No trips recorded for this month.</p>}
      </div>
      <div className="admin-table-wrap">
        <div className="fleet-card-head pad"><b><Route size={14} /> Recent trips</b><small>{stats.tripCount} this month · average {avgTripKm.toFixed(1)} km</small></div>
        <table className="admin-table">
          <thead><tr><th>Trip</th><th>Route</th><th>Km</th><th>Fare</th></tr></thead>
          <tbody>
            {stats.trips.slice(0, 12).map((t) => <tr key={t.id}><td><b>{t.id}</b><small>{t.date}</small></td><td>{t.pickup} → {t.destination}<small>{t.minutes} min</small></td><td>{t.km}</td><td>AED {t.fare.toFixed(2)}</td></tr>)}
            {!stats.trips.length && <tr><td colSpan={4} className="admin-empty">No trips yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </section>;
}

function KpiModal({ kpi, onClose, onSave }: { kpi: KpiSettings; onClose: () => void; onSave: (k: KpiSettings) => void }) {
  const [error, setError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([k, v]) => [k, Number(v)])) as unknown as KpiSettings;
    if (!(f.breakEven < f.target && f.target < f.excellent)) { setError("Break-even must be lower than target, and target lower than excellent."); return; }
    onSave(f);
  };
  const field = (name: keyof KpiSettings, label: string, step = "1") => <label><span>{label}</span><input name={name} type="number" min="0" step={step} required defaultValue={kpi[name]} /></label>;
  return <div className="admin-modal-backdrop" onClick={onClose}>
    <form className="admin-modal admin-form" role="dialog" aria-modal="true" aria-labelledby="kpi-title" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
      <div className="admin-modal-head"><h2 id="kpi-title">KPI settings</h2><button type="button" className="admin-x" aria-label="Close" onClick={onClose}><X size={16} /></button></div>
      <p>Revenue per hour (AED) that each driver should bring in. These defaults are estimates for a Dubai sedan; adjust them to match your real costs.</p>
      <div className="auth-row">{field("breakEven", "Break-even / hour")}{field("target", "Target / hour")}{field("excellent", "Excellent / hour")}</div>
      {field("maxCostShare", "Max. fuel + maintenance (% of revenue)")}
      <p className="admin-form-note">Used only when no costs have been entered for a driver:</p>
      <div className="auth-row">{field("fuelPerKm", "Estimated fuel per km (AED)", "0.01")}{field("maintenancePerKm", "Estimated maintenance per km (AED)", "0.01")}</div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="admin-modal-actions"><button type="button" className="admin-btn" onClick={() => onSave(DEFAULT_KPI)}>Reset to defaults</button><button className="admin-btn primary">Save</button></div>
    </form>
  </div>;
}
