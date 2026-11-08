import { useEffect, useMemo, useState, type FormEvent } from "react";
import FleetView from "./Fleet";
import { useNavigate, useParams } from "react-router-dom";
import { Ban, BadgeCheck, CarFront, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, LogOut, Gauge, Users, Pencil, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, Trash2, UserRound, X } from "lucide-react";

type AdminUser = {
  id: string;
  role: "rider" | "driver";
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  suspended: boolean;
  driver: { vehicle: string; plateNumber: string; licenseNumber: string; status: string } | null;
};

/** A laptop/desktop: a large physical screen, a precise pointer, and not a touch tablet posing as a Mac. */
function isLaptopDevice() {
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad|iPod|Tablet|Silk|Kindle|PlayBook|BlackBerry|Opera Mini|IEMobile|webOS/i.test(ua)) return false;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return false; // iPadOS
  const largeScreen = Math.max(screen.width, screen.height) >= 1024;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  return largeScreen && finePointer;
}

function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow, noarchive";
    document.head.appendChild(meta);
    const previousTitle = document.title;
    document.title = "GoRide";
    return () => { meta.remove(); document.title = previousTitle; };
  }, []);
}

export default function AdminPortal() {
  const { key = "" } = useParams();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"checking" | "login" | "ready">("checking");
  useNoIndex();

  const api = (path: string, init: RequestInit = {}) =>
    fetch(`/api/admin/${path}`, { ...init, credentials: "same-origin", headers: { ...(init.headers ?? {}), "x-admin-key": key, "content-type": "application/json" } });

  useEffect(() => {
    let cancelled = false;
    const leave = () => { if (!cancelled) navigate("/dashboard", { replace: true }); };
    if (!isLaptopDevice()) { leave(); return; }
    (async () => {
      try {
        const gate = await fetch(`/api/admin/gate?key=${encodeURIComponent(key)}`, { credentials: "same-origin" });
        if (!gate.ok) return leave();
        const session = await api("session");
        if (cancelled) return;
        if (session.status === 404) return leave();
        setPhase(session.ok ? "ready" : "login");
      } catch { leave(); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (phase === "checking") return <div className="admin-shell admin-center"><LoaderCircle className="spin" size={22} /></div>;
  if (phase === "login") return <AdminLogin api={api} onSuccess={() => setPhase("ready")} />;
  return <AdminDashboard api={api} onSignedOut={() => setPhase("login")} />;
}

type Api = (path: string, init?: RequestInit) => Promise<Response>;

function AdminLogin({ api, onSuccess }: { api: Api; onSuccess: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const res = await api("login", { method: "POST", body: JSON.stringify(form) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onSuccess(); else setError(data.error ?? "Sign-in failed.");
    } catch { setError("Sign-in is unavailable right now."); }
    finally { setBusy(false); }
  };
  return <div className="admin-shell admin-center">
    <form className="admin-login" onSubmit={submit} autoComplete="off">
      <div className="admin-lock"><LockKeyhole size={20} /></div>
      <h1>Restricted area</h1>
      <p>Authorised GoRide administrators only.</p>
      <label>Login<input name="login" required autoComplete="username" spellCheck={false} /></label>
      <label>Password<span className="password-field"><input name="password" type={show ? "text" : "password"} required autoComplete="current-password" /><button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
      <label>Passcode<input name="passcode" type="password" inputMode="numeric" required autoComplete="one-time-code" /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button className="btn-primary full-btn" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <ShieldCheck size={16} />} Sign in</button>
    </form>
  </div>;
}

function AdminDashboard({ api, onSignedOut }: { api: Api; onSignedOut: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"all" | "rider" | "driver" | "pending" | "suspended">("all");
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState<AdminUser | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState("");
  const [view, setView] = useState<"accounts" | "fleet">("accounts");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api("users");
      if (res.status === 401 || res.status === 404) { onSignedOut(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUsers(data.users);
    } catch (e) { setError(e instanceof Error && e.message ? e.message : "Could not load accounts."); }
    finally { setLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const setStatus = async (user: AdminUser, status: "approved" | "rejected" | "pending") => {
    setSavingId(user.id);
    try {
      const res = await api("driver-status", { method: "POST", body: JSON.stringify({ userId: user.id, status }) });
      if (res.status === 401 || res.status === 404) { onSignedOut(); return; }
      if (res.ok) setUsers((list) => list.map((u) => u.id === user.id && u.driver ? { ...u, driver: { ...u.driver, status } } : u));
      else setError((await res.json().catch(() => ({}))).error ?? "Could not update the driver.");
    } finally { setSavingId(""); }
  };

  const setSuspended = async (user: AdminUser, suspended: boolean) => {
    setSavingId(user.id);
    setError("");
    try {
      const res = await api("account-status", { method: "POST", body: JSON.stringify({ userId: user.id, suspended }) });
      if (res.status === 401) { onSignedOut(); return; }
      if (res.ok) { setUsers((list) => list.map((u) => u.id === user.id ? { ...u, suspended } : u)); flash(`${user.fullName} ${suspended ? "is suspended" : "is active again"}.`); }
      else setError((await res.json().catch(() => ({}))).error ?? "Could not update the account.");
    } finally { setSavingId(""); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const user = deleting;
    setSavingId(user.id);
    setError("");
    try {
      const res = await api(`users?userId=${encodeURIComponent(user.id)}`, { method: "DELETE" });
      if (res.status === 401) { onSignedOut(); return; }
      if (res.ok) { setUsers((list) => list.filter((u) => u.id !== user.id)); flash(`${user.fullName}'s account was deleted.`); setDeleting(null); }
      else setError((await res.json().catch(() => ({}))).error ?? "Could not delete the account.");
    } finally { setSavingId(""); }
  };

  const flash = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(""), 3500); };

  const signOut = async () => { await api("session", { method: "DELETE" }).catch(() => undefined); onSignedOut(); };

  const counts = useMemo(() => ({
    all: users.length,
    rider: users.filter((u) => u.role === "rider").length,
    driver: users.filter((u) => u.role === "driver").length,
    pending: users.filter((u) => u.driver?.status === "pending").length,
    suspended: users.filter((u) => u.suspended).length,
  }), [users]);

  const visible = users.filter((u) => {
    if (tab === "rider" && u.role !== "rider") return false;
    if (tab === "driver" && u.role !== "driver") return false;
    if (tab === "pending" && u.driver?.status !== "pending") return false;
    if (tab === "suspended" && !u.suspended) return false;
    const q = query.trim().toLowerCase();
    return !q || [u.fullName, u.email, u.phone, u.driver?.plateNumber, u.driver?.vehicle].some((v) => v?.toLowerCase().includes(q));
  });

  return <div className="admin-shell">
    <header className="admin-top">
      <div className="admin-brand"><span className="brand-mark"><ShieldCheck size={16} /></span><b>GoRide Admin</b></div>
      <nav className="admin-views" aria-label="Admin sections">
        <button className={view === "accounts" ? "active" : ""} onClick={() => setView("accounts")}><Users size={15} /> Accounts</button>
        <button className={view === "fleet" ? "active" : ""} onClick={() => setView("fleet")}><Gauge size={15} /> Driver performance</button>
      </nav>
      <div className="admin-top-actions">
        <button className="admin-ghost" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} /> Refresh</button>
        <button className="admin-ghost" onClick={signOut}><LogOut size={15} /> Sign out</button>
      </div>
    </header>
    {view === "fleet" ? <main className="admin-main"><FleetView api={api} users={users} onSignedOut={onSignedOut} /></main> : <main className="admin-main">
      <div className="admin-stats">
        <div><small>Total accounts</small><b>{counts.all}</b></div>
        <div><small>Riders</small><b>{counts.rider}</b></div>
        <div><small>Drivers</small><b>{counts.driver}</b></div>
        <div className="warn"><small>Drivers awaiting approval</small><b>{counts.pending}</b></div>
      </div>
      <div className="admin-toolbar">
        <div className="admin-tabs">{(["all", "rider", "driver", "pending", "suspended"] as const).map((t) => <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{{ all: "All", rider: "Riders", driver: "Drivers", pending: "Pending", suspended: "Suspended" }[t]} <span>{counts[t]}</span></button>)}</div>
        <label className="admin-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email, phone or plate" />{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}</label>
        <button className="btn-primary admin-add" onClick={() => setEditing("new")}><Plus size={15} /> Add account</button>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {notice && <div className="admin-notice" role="status">{notice}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Account</th><th>Type</th><th>Contact</th><th>Vehicle</th><th>Joined</th><th>Driver status</th><th className="admin-actions-col">Actions</th></tr></thead>
          <tbody>
            {visible.map((u) => <tr key={u.id} className={u.suspended ? "is-suspended" : ""}>
              <td><b>{u.fullName}</b><small>{u.email}</small>{u.suspended && <span className="status-pill rejected admin-suspended"><Ban size={12} /> Suspended</span>}</td>
              <td><span className={`admin-role ${u.role}`}>{u.role === "driver" ? <CarFront size={13} /> : <UserRound size={13} />} {u.role === "driver" ? "Driver" : "Rider"}</span></td>
              <td>{u.phone ?? <span className="muted">—</span>}</td>
              <td>{u.driver ? <><b>{u.driver.vehicle}</b><small>{u.driver.plateNumber} · Licence {u.driver.licenseNumber}</small></> : <span className="muted">—</span>}</td>
              <td>{new Date(u.createdAt).toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}</td>
              <td>{u.driver ? <div className="admin-status">
                <span className={`status-pill ${u.driver.status}`}>{u.driver.status === "approved" && <BadgeCheck size={13} />}{u.driver.status}</span>
                {u.driver.status !== "approved" && <button disabled={savingId === u.id} onClick={() => setStatus(u, "approved")}>Approve</button>}
                {u.driver.status !== "rejected" && <button className="danger" disabled={savingId === u.id} onClick={() => setStatus(u, "rejected")}>Reject</button>}
              </div> : <span className="muted">—</span>}</td>
              <td><div className="admin-row-actions">
                <button title="Edit" aria-label={`Edit ${u.fullName}`} onClick={() => setEditing(u)}><Pencil size={14} /></button>
                <button title="Reset password" aria-label={`Reset password for ${u.fullName}`} onClick={() => setResetting(u)}><KeyRound size={14} /></button>
                {u.suspended
                  ? <button title="Reactivate" aria-label={`Reactivate ${u.fullName}`} disabled={savingId === u.id} onClick={() => setSuspended(u, false)}><RotateCcw size={14} /></button>
                  : <button title="Suspend" aria-label={`Suspend ${u.fullName}`} disabled={savingId === u.id} onClick={() => setSuspended(u, true)}><Ban size={14} /></button>}
                <button title="Delete" aria-label={`Delete ${u.fullName}`} className="danger" disabled={savingId === u.id} onClick={() => setDeleting(u)}><Trash2 size={14} /></button>
              </div></td>
            </tr>)}
            {!loading && visible.length === 0 && <tr><td colSpan={7} className="admin-empty">No accounts match.</td></tr>}
          </tbody>
        </table>
      </div>
    </main>}
    {editing && <AccountModal api={api} user={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={(text) => { setEditing(null); flash(text); load(); }} onSignedOut={onSignedOut} />}
    {resetting && <ResetPasswordModal api={api} user={resetting} onClose={() => setResetting(null)} onSaved={(text) => { setResetting(null); flash(text); }} onSignedOut={onSignedOut} />}
    {deleting && <div className="admin-modal-backdrop" onClick={() => setDeleting(null)}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="del-title" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-icon danger"><Trash2 size={18} /></div>
        <h2 id="del-title">Delete {deleting.fullName}?</h2>
        <p>This permanently removes the {deleting.role} account for <b>{deleting.email}</b>{deleting.role === "driver" ? " and their vehicle details" : ""}. It cannot be undone. If you only want to stop them using GoRide, suspend the account instead.</p>
        <div className="admin-modal-actions"><button className="admin-btn" onClick={() => setDeleting(null)}>Cancel</button><button className="admin-btn danger" disabled={savingId === deleting.id} onClick={confirmDelete}>{savingId === deleting.id ? <LoaderCircle size={14} className="spin" /> : <Trash2 size={14} />} Delete permanently</button></div>
      </div>
    </div>}
  </div>;
}

function AccountModal({ api, user, onClose, onSaved, onSignedOut }: { api: Api; user: AdminUser | null; onClose: () => void; onSaved: (text: string) => void; onSignedOut: () => void }) {
  const isNew = !user;
  const [role, setRole] = useState<"rider" | "driver">(user?.role ?? "rider");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const res = await api("users", { method: isNew ? "POST" : "PATCH", body: JSON.stringify(isNew ? { ...form, role } : { ...form, userId: user.id }) });
      if (res.status === 401) { onSignedOut(); return; }
      const data = await res.json().catch(() => ({}));
      if (res.ok) onSaved(isNew ? `${form.fullName} was added as a ${role}.` : `${form.fullName}'s details were saved.`);
      else setError(data.error ?? "Could not save.");
    } catch { setError("Could not save right now."); }
    finally { setBusy(false); }
  };
  return <div className="admin-modal-backdrop" onClick={onClose}>
    <form className="admin-modal admin-form" role="dialog" aria-modal="true" aria-labelledby="acct-title" onClick={(e) => e.stopPropagation()} onSubmit={submit} autoComplete="off">
      <div className="admin-modal-head"><h2 id="acct-title">{isNew ? "Add an account" : `Edit ${user.fullName}`}</h2><button type="button" className="admin-x" aria-label="Close" onClick={onClose}><X size={16} /></button></div>
      {isNew ? <div className="role-switch" role="radiogroup" aria-label="Account type">
        <button type="button" role="radio" aria-checked={role === "rider"} className={role === "rider" ? "active" : ""} onClick={() => setRole("rider")}><UserRound size={17} /><span><b>Rider</b></span></button>
        <button type="button" role="radio" aria-checked={role === "driver"} className={role === "driver" ? "active" : ""} onClick={() => setRole("driver")}><CarFront size={17} /><span><b>Driver</b></span></button>
      </div> : <p className="admin-form-note">{user.role === "driver" ? "Driver" : "Rider"} account · the account type cannot be changed.</p>}
      <label>Full name<input name="fullName" required minLength={2} defaultValue={user?.fullName} /></label>
      <label>Email<input name="email" type="email" required defaultValue={user?.email} /></label>
      <label><span>Mobile number <em>(optional)</em></span><input name="phone" type="tel" defaultValue={user?.phone ?? ""} /></label>
      {isNew && <label><span>Temporary password <em>(share it with the person; at least 8 characters)</em></span><input name="password" type="text" required minLength={8} autoComplete="new-password" /></label>}
      {role === "driver" && <fieldset className="driver-fields"><legend>Vehicle</legend>
        <label>Vehicle make &amp; model<input name="vehicle" required defaultValue={user?.driver?.vehicle} /></label>
        <div className="auth-row"><label>Plate number<input name="plateNumber" required defaultValue={user?.driver?.plateNumber} /></label><label>Driving licence no.<input name="licenseNumber" required defaultValue={user?.driver?.licenseNumber} /></label></div>
        {isNew && <p className="admin-form-note">Drivers added here are approved straight away.</p>}
      </fieldset>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="admin-modal-actions"><button type="button" className="admin-btn" onClick={onClose}>Cancel</button><button className="admin-btn primary" disabled={busy}>{busy && <LoaderCircle size={14} className="spin" />}{isNew ? "Add account" : "Save changes"}</button></div>
    </form>
  </div>;
}

function ResetPasswordModal({ api, user, onClose, onSaved, onSignedOut }: { api: Api; user: AdminUser; onClose: () => void; onSaved: (text: string) => void; onSignedOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setBusy(true);
    try {
      const res = await api("reset-password", { method: "POST", body: JSON.stringify({ userId: user.id, password }) });
      if (res.status === 401) { onSignedOut(); return; }
      const data = await res.json().catch(() => ({}));
      if (res.ok) onSaved(`${user.fullName}'s password was reset. Share the temporary password with them privately.`);
      else setError(data.error ?? "Could not reset the password.");
    } catch { setError("Could not reset the password right now."); }
    finally { setBusy(false); }
  };
  return <div className="admin-modal-backdrop" onClick={onClose}>
    <form className="admin-modal admin-form" role="dialog" aria-modal="true" aria-labelledby="reset-title" onClick={(e) => e.stopPropagation()} onSubmit={submit} autoComplete="off">
      <div className="admin-modal-head"><h2 id="reset-title">Reset password</h2><button type="button" className="admin-x" aria-label="Close" onClick={onClose}><X size={16} /></button></div>
      <p>Set a new temporary password for <b>{user.fullName}</b> ({user.email}). They will be signed out on every device and can change it from their Profile page after logging in.</p>
      <label><span>New temporary password <em>(at least 8 characters)</em></span><input name="password" type="text" required minLength={8} autoComplete="new-password" /></label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="admin-modal-actions"><button type="button" className="admin-btn" onClick={onClose}>Cancel</button><button className="admin-btn primary" disabled={busy}>{busy && <LoaderCircle size={14} className="spin" />}Reset password</button></div>
    </form>
  </div>;
}
