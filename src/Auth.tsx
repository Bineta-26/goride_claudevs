import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CarFront, Eye, EyeOff, LoaderCircle, UserRound } from "lucide-react";

export type Role = "rider" | "driver";
export type AccountUser = {
  id: string;
  role: Role;
  fullName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  driver?: { vehicle: string; plateNumber: string; licenseNumber: string; status: string } | null;
};

type AuthState = {
  user: AccountUser | null;
  loading: boolean;
  setUser: (user: AccountUser | null) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({ user: null, loading: true, setUser: () => {}, logout: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    setUser(null);
  };
  return <AuthContext.Provider value={{ user, loading, setUser, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "GR";
}

export function AuthPage({ mode }: { mode: "signup" | "login" }) {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [role, setRole] = useState<Role>(() => (new URLSearchParams(window.location.search).get("role") === "driver" ? "driver" : "rider"));
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(mode === "signup" ? { ...form, role } : form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.user) { setError(data.error ?? "Something went wrong. Please try again."); return; }
      setUser(data.user);
      navigate(data.user.role === "driver" ? "/driver" : "/dashboard");
    } catch {
      setError("We could not reach GoRide. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const isSignup = mode === "signup";
  return <div className="auth-page">
    <div className="auth-card panel">
      <span className="eyebrow">{isSignup ? "JOIN GORIDE" : "WELCOME BACK"}</span>
      <h1>{isSignup ? "Create your account" : "Log in to GoRide"}</h1>
      <p className="auth-sub">{isSignup ? "Ride across the city or drive and earn — pick the account that fits you." : "Good to see you again. Pick up right where you left off."}</p>

      {isSignup && <div className="role-switch" role="radiogroup" aria-label="Account type">
        <button type="button" role="radio" aria-checked={role === "rider"} className={role === "rider" ? "active" : ""} onClick={() => setRole("rider")}><UserRound size={18} /><span><b>Rider</b><small>Book and track rides</small></span></button>
        <button type="button" role="radio" aria-checked={role === "driver"} className={role === "driver" ? "active" : ""} onClick={() => setRole("driver")}><CarFront size={18} /><span><b>Driver</b><small>Drive and earn</small></span></button>
      </div>}

      <form className="auth-form" onSubmit={submit}>
        {isSignup && <label>Full name<input name="fullName" autoComplete="name" required minLength={2} placeholder="e.g. Amira Malik" /></label>}
        <label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
        {isSignup && <label><span>Mobile number <em>(optional)</em></span><input name="phone" type="tel" autoComplete="tel" placeholder="+971 50 000 0000" /></label>}
        <label>Password
          <span className="password-field"><input name="password" type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} required minLength={isSignup ? 8 : 1} placeholder={isSignup ? "At least 8 characters" : "Your password"} />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span>
        </label>
        {isSignup && role === "driver" && <fieldset className="driver-fields">
          <legend>Your vehicle</legend>
          <label>Vehicle make &amp; model<input name="vehicle" required placeholder="e.g. Toyota Camry 2023" /></label>
          <div className="auth-row">
            <label>Plate number<input name="plateNumber" required placeholder="e.g. DXB A 12345" /></label>
            <label>Driving licence no.<input name="licenseNumber" required placeholder="Licence number" /></label>
          </div>
        </fieldset>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="btn-primary full-btn" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : null}{isSignup ? `Create ${role} account` : "Log in"} {!busy && <ArrowRight size={16} />}</button>
      </form>
      <p className="auth-switch">{isSignup ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New to GoRide? <Link to="/signup">Create an account</Link></>}</p>
    </div>
  </div>;
}

export function ChangePasswordPanel({ onDone }: { onDone: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    if (data.newPassword !== data.confirmPassword) { setError("The new passwords do not match."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error ?? "Could not change your password."); return; }
      form.reset();
      setOpen(false);
      onDone("Your password has been changed. Other devices have been signed out.");
    } catch { setError("We could not reach GoRide. Please try again."); }
    finally { setBusy(false); }
  };
  return <div className="panel settings-panel password-panel">
    <div className="section-title"><h2>Password &amp; security</h2>{!open && <button className="text-link" onClick={() => setOpen(true)}>Change password <ArrowRight size={14} /></button>}</div>
    {!open ? <p className="password-hint">Use a strong password you do not use anywhere else. Changing it signs you out on other devices.</p> :
    <form className="auth-form" onSubmit={submit}>
      <label>Current password<span className="password-field"><input name="currentPassword" type={show ? "text" : "password"} required autoComplete="current-password" /><button type="button" aria-label={show ? "Hide passwords" : "Show passwords"} onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
      <div className="auth-row">
        <label>New password<input name="newPassword" type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /></label>
        <label>Confirm new password<input name="confirmPassword" type={show ? "text" : "password"} required minLength={8} autoComplete="new-password" /></label>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="password-actions"><button type="button" className="text-link" onClick={() => { setOpen(false); setError(""); }}>Cancel</button><button className="btn-primary" disabled={busy}>{busy && <LoaderCircle size={15} className="spin" />} Update password</button></div>
    </form>}
  </div>;
}
