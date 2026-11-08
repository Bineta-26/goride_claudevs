import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, CalendarDays, Check, CheckCheck, Copy, CreditCard, Download, Headphones, MapPin, MessageCircle, Mic, MicOff, Phone, PhoneOff, Plus, Printer, Search, Send, ShieldCheck, Trash2, Wallet, X } from "lucide-react";
import { cityOf, estimateFare, places, rideTypes, routeKm, type Booking } from "./data";
import { fmtDate, methodLabel, newId, type Lang, type Notice, type PaymentMethod, type RiderData, type SavedPlace, type Ticket } from "./riderData";
import { useT } from "./i18n";

export const STOP_FEE = 5;
export const rideIdOf = (b: Booking) => b.rideId ?? rideTypes.find((r) => r.name === b.category)?.id ?? "comfort";
export function priceRoute(b: Booking, change: Partial<Pick<Booking, "pickup" | "destination" | "stop">>) {
  const next = { ...b, ...change };
  const distanceKm = routeKm(next.pickup, next.destination, next.stop || undefined);
  const fare = Math.round((estimateFare(rideIdOf(b), distanceKm) + (next.stop ? STOP_FEE : 0)) * 100) / 100;
  return { distanceKm, fare };
}

export function Modal({ title, onClose, children, wide = false, icon }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; icon?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="rider-modal-backdrop" onMouseDown={onClose}>
    <div className={`rider-modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}>
      <div className="rider-modal-head">{icon && <span className="rider-modal-icon">{icon}</span>}<h2>{title}</h2><button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
      {children}
    </div>
  </div>;
}

/** Text field with place suggestions (all supported Dubai, Sharjah and Abu Dhabi places). */
export function PlacePicker({ label, value, onChange, exclude = [], city, autoFocus }: { label: string; value: string; onChange: (v: string) => void; exclude?: string[]; city?: string; autoFocus?: boolean }) {
  const [open, setOpen] = useState(!!autoFocus);
  const matches = places.filter((p) => !exclude.includes(p.name) && (!value || `${p.name} ${p.detail}`.toLowerCase().includes(value.toLowerCase())))
    .sort((a, b) => Number(cityOf(b) === city) - Number(cityOf(a) === city)).slice(0, 6);
  return <label className="place-picker"><span>{label}</span>
    <input value={value} autoFocus={autoFocus} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 150)} placeholder="Search a place" autoComplete="off" />
    {open && matches.length > 0 && <div className="place-picker-list">{matches.map((p) => <button type="button" key={p.name} onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(p.name); setOpen(false); }}><MapPin size={14} /><span><b>{p.name}</b><small>{p.detail}</small></span></button>)}</div>}
  </label>;
}
const isPlace = (name: string) => places.some((p) => p.name === name);

export function NotificationsMenu({ notices, onOpen, onMarkAll, onClear, onClose }: { notices: Notice[]; onOpen: (n: Notice) => void; onMarkAll: () => void; onClear: () => void; onClose: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.setTimeout(() => document.addEventListener("mousedown", away), 0);
    return () => document.removeEventListener("mousedown", away);
  }, [onClose]);
  const unread = notices.filter((n) => !n.read).length;
  return <div className="pop-menu notifications-menu" ref={ref}>
    <div className="pop-menu-head"><b>{t("Notifications")}</b>{unread > 0 && <span className="count-pill">{unread} new</span>}<button className="text-link" onClick={onMarkAll} disabled={!unread}><CheckCheck size={14} /> Mark all read</button></div>
    <div className="pop-menu-list">
      {notices.length ? notices.map((n) => <button key={n.id} className={`notice-row ${n.read ? "" : "unread"}`} onClick={() => onOpen(n)}><span className="notice-dot" /><span><b>{n.title}</b><small>{n.body}</small><em>{n.time}</em></span></button>)
        : <div className="empty-inline"><Bell size={18} /><b>You're all caught up</b><span>New ride updates will appear here.</span></div>}
    </div>
    {notices.length > 0 && <button className="pop-menu-foot" onClick={onClear}>Clear all</button>}
  </div>;
}

export function CityMenu({ city, onPick, onClose }: { city: string; onPick: (c: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    window.setTimeout(() => document.addEventListener("mousedown", away), 0);
    return () => document.removeEventListener("mousedown", away);
  }, [onClose]);
  return <div className="pop-menu city-menu" ref={ref}>{["Dubai", "Sharjah", "Abu Dhabi"].map((c) => <button key={c} className={c === city ? "active" : ""} onClick={() => onPick(c)}><MapPin size={14} /> {c}, UAE {c === city && <Check size={14} />}</button>)}</div>;
}

export function ReceiptModal({ trip, rider, onClose }: { trip: Booking; rider: string; onClose: () => void }) {
  const ride = rideTypes.find((r) => r.id === rideIdOf(trip)) ?? rideTypes[0];
  const km = trip.distanceKm ?? routeKm(trip.pickup, trip.destination, trip.stop);
  const base = 12 * ride.price;
  const stopFee = trip.stop ? STOP_FEE : 0;
  const distance = Math.max(0, trip.fare - base - stopFee);
  return <Modal title={`Receipt ${trip.id}`} onClose={onClose} icon={<Download size={17} />}>
    <div className="receipt" id="printable-receipt">
      <div className="receipt-brand"><b>GoRide</b><span>Demo receipt · not a tax invoice</span></div>
      <div className="receipt-meta"><span>{trip.date}</span><span>{rider}</span><span>{trip.status}</span></div>
      <div className="receipt-route"><div><i className="route-start" /><b>{trip.pickup}</b></div>{trip.stop && <div><i className="route-stop" /><b>{trip.stop}</b><small>Stop</small></div>}<div><i className="route-end" /><b>{trip.destination}</b></div></div>
      <div className="receipt-lines">
        <div><span>{ride.name} · base fare</span><b>AED {base.toFixed(2)}</b></div>
        <div><span>Distance · {km.toFixed(1)} km</span><b>AED {distance.toFixed(2)}</b></div>
        {stopFee > 0 && <div><span>Extra stop</span><b>AED {stopFee.toFixed(2)}</b></div>}
        <div className="total"><span>Total</span><b>AED {trip.fare.toFixed(2)}</b></div>
        <div><span>Paid with</span><b>{trip.payment ?? "Visa ···· 4242"}</b></div>
      </div>
      {trip.changes?.length ? <div className="receipt-changes"><b>Route changes during this ride</b>{trip.changes.map((c, i) => <small key={i}>{c}</small>)}</div> : null}
    </div>
    <div className="rider-modal-actions"><button className="btn-quiet" onClick={onClose}>Close</button><button className="btn-primary" onClick={() => { document.body.classList.add("printing-receipt"); window.print(); window.setTimeout(() => document.body.classList.remove("printing-receipt"), 500); }}><Printer size={15} /> Print or save as PDF</button></div>
  </Modal>;
}

const driverReplies = ["On my way! I'll be there shortly.", "Got it, thank you.", "I'm in the white Tesla, plate L 48291.", "No problem, take your time.", "Traffic is light, see you soon."];
export function ChatModal({ driver, onClose }: { driver: string; onClose: () => void }) {
  const [msgs, setMsgs] = useState<{ me: boolean; text: string; at: string }[]>([{ me: false, text: `Hi, this is ${driver}. I'm heading to your pickup now.`, at: new Date().toLocaleTimeString("en-AE", { hour: "numeric", minute: "2-digit" }) }]);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  const send = (value: string) => {
    if (!value.trim()) return;
    const at = new Date().toLocaleTimeString("en-AE", { hour: "numeric", minute: "2-digit" });
    setMsgs((m) => [...m, { me: true, text: value.trim(), at }]);
    setText("");
    window.setTimeout(() => setMsgs((m) => [...m, { me: false, text: driverReplies[m.length % driverReplies.length], at }]), 1200);
  };
  return <Modal title={`Message ${driver}`} onClose={onClose} icon={<MessageCircle size={17} />}>
    <div className="chat-list">{msgs.map((m, i) => <div key={i} className={`chat-bubble ${m.me ? "me" : ""}`}>{m.text}<small>{m.at}</small></div>)}<div ref={end} /></div>
    <div className="chat-quick">{["I'm at the main entrance", "Running 2 minutes late", "Please call when you arrive"].map((q) => <button key={q} onClick={() => send(q)}>{q}</button>)}</div>
    <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(text); }}><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" autoFocus /><button className="btn-primary" aria-label="Send"><Send size={15} /></button></form>
    <small className="modal-note">Demo chat · replies are automatic.</small>
  </Modal>;
}

export function CallModal({ driver, onClose }: { driver: string; onClose: () => void }) {
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [connected, setConnected] = useState(false);
  useEffect(() => { const c = window.setTimeout(() => setConnected(true), 1800); const t = window.setInterval(() => setSeconds((s) => s + 1), 1000); return () => { window.clearTimeout(c); window.clearInterval(t); }; }, []);
  const time = connected ? `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` : "Calling…";
  return <Modal title={`Call ${driver}`} onClose={onClose} icon={<Phone size={17} />}>
    <div className="call-screen"><div className="call-avatar">{driver.split(" ").map((p) => p[0]).join("")}</div><b>{driver}</b><span>{time}</span><small>Your number is hidden from the driver.</small>
      <div className="call-actions"><button className={muted ? "on" : ""} onClick={() => setMuted(!muted)} aria-label="Mute">{muted ? <MicOff size={19} /> : <Mic size={19} />}</button><button className="end" onClick={onClose} aria-label="End call"><PhoneOff size={19} /></button></div>
    </div>
    <small className="modal-note">Demo call · no phone call is placed.</small>
  </Modal>;
}

export async function shareTrip(b: Booking): Promise<string> {
  const text = `I'm on a GoRide trip: ${b.pickup}${b.stop ? ` → ${b.stop}` : ""} → ${b.destination}. Ride ${b.id}, ${b.category}.`;
  const url = `${location.origin}/tracking`;
  try {
    if (navigator.share) { await navigator.share({ title: "My GoRide trip", text, url }); return "Trip shared."; }
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "Trip details copied. Paste them to anyone you trust.";
  } catch { return "Sharing was cancelled."; }
}

export function AddMethodModal({ onSave, onClose }: { onSave: (m: PaymentMethod) => void; onClose: () => void }) {
  const [error, setError] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    if (!/^\d{4}$/.test(f.last4)) { setError("Enter only the last 4 digits."); return; }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(f.expiry)) { setError("Expiry should look like 08/28."); return; }
    onSave({ id: newId(), kind: "card", brand: f.brand, last4: f.last4, expiry: f.expiry, nickname: f.nickname || undefined, isDefault: f.makeDefault === "on" });
  };
  return <Modal title="Add a payment method" onClose={onClose} icon={<CreditCard size={17} />}>
    <form className="rider-form" onSubmit={submit}>
      <label>Card type<select name="brand"><option>Visa</option><option>Mastercard</option><option>Amex</option></select></label>
      <div className="rider-form-row"><label>Last 4 digits<input name="last4" inputMode="numeric" maxLength={4} required placeholder="1234" /></label><label>Expiry<input name="expiry" required placeholder="MM/YY" maxLength={5} /></label></div>
      <label>Nickname <em>(optional)</em><input name="nickname" placeholder="Personal, Work…" maxLength={30} /></label>
      <label className="check-label"><input type="checkbox" name="makeDefault" /> Make this my default</label>
      {error && <div className="auth-error">{error}</div>}
      <p className="modal-note"><ShieldCheck size={13} /> Demo only: never enter a full card number. GoRide stores just a label for this card.</p>
      <div className="rider-modal-actions"><button type="button" className="btn-quiet" onClick={onClose}>Cancel</button><button className="btn-primary"><Plus size={15} /> Add card</button></div>
    </form>
  </Modal>;
}

export function TopUpModal({ methods, onSave, onClose }: { methods: PaymentMethod[]; onSave: (amount: number, method: string) => void; onClose: () => void }) {
  const cards = methods.filter((m) => m.kind === "card");
  const [amount, setAmount] = useState(100);
  const [method, setMethod] = useState(cards[0] ? methodLabel(cards[0]) : "");
  return <Modal title="Top up your wallet" onClose={onClose} icon={<Wallet size={17} />}>
    <div className="rider-form">
      <div className="amount-chips">{[50, 100, 200, 500].map((a) => <button key={a} type="button" className={a === amount ? "selected" : ""} onClick={() => setAmount(a)}>AED {a}</button>)}</div>
      <label>Amount (AED)<input type="number" min={10} max={5000} value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></label>
      {cards.length ? <label>Pay with<select value={method} onChange={(e) => setMethod(e.target.value)}>{cards.map((c) => <option key={c.id}>{methodLabel(c)}</option>)}</select></label> : <p className="modal-note">Add a card first to top up.</p>}
      <p className="modal-note"><ShieldCheck size={13} /> Demo top-up · no money is charged.</p>
      <div className="rider-modal-actions"><button className="btn-quiet" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!cards.length || amount < 10 || amount > 5000} onClick={() => onSave(amount, method)}>Add AED {amount || 0}</button></div>
    </div>
  </Modal>;
}

export function SavedPlaceModal({ place, city, onSave, onDelete, onClose }: { place: SavedPlace | null; city: string; onSave: (p: SavedPlace) => void; onDelete?: () => void; onClose: () => void }) {
  const [label, setLabel] = useState(place?.label ?? "");
  const [where, setWhere] = useState(place?.place ?? "");
  const [icon, setIcon] = useState<SavedPlace["icon"]>(place?.icon ?? "star");
  const ok = label.trim().length > 0 && isPlace(where);
  return <Modal title={place ? `Edit ${place.label}` : "Add a favourite place"} onClose={onClose} icon={<MapPin size={17} />}>
    <div className="rider-form">
      <label>Name<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home, Work, Gym…" maxLength={24} autoFocus /></label>
      <PlacePicker label="Location" value={where} onChange={setWhere} city={city} />
      <div className="icon-choice">{(["home", "work", "star"] as const).map((i) => <button type="button" key={i} className={icon === i ? "selected" : ""} onClick={() => setIcon(i)}>{i === "home" ? "Home" : i === "work" ? "Work" : "Other"}</button>)}</div>
      {!isPlace(where) && where && <small className="modal-note">Choose a place from the list.</small>}
      <div className="rider-modal-actions">{onDelete && <button className="btn-quiet danger" onClick={onDelete}><Trash2 size={14} /> Remove</button>}<button className="btn-quiet" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!ok} onClick={() => onSave({ id: place?.id ?? newId(), label: label.trim(), place: where, icon })}>Save place</button></div>
    </div>
  </Modal>;
}

export function LanguageModal({ lang, onPick, onClose }: { lang: Lang; onPick: (l: Lang) => void; onClose: () => void }) {
  return <Modal title="Language" onClose={onClose} icon={<MessageCircle size={17} />}>
    <div className="choice-list">{([["en", "English (United Kingdom)"], ["ar", "العربية (Arabic)"]] as const).map(([code, name]) => <button key={code} className={lang === code ? "selected" : ""} onClick={() => onPick(code)}>{name}{lang === code && <Check size={15} />}</button>)}</div>
    <p className="modal-note">Arabic covers the menus, page titles and main buttons.</p>
  </Modal>;
}

export function EmergencyModal({ booking, onShare, onClose }: { booking: Booking | null; onShare: () => void; onClose: () => void }) {
  return <Modal title="Emergency help" onClose={onClose} icon={<ShieldCheck size={17} />}>
    <div className="emergency-list">
      <a className="emergency-call" href="tel:999"><Phone size={18} /><span><b>Police · 999</b><small>Calls UAE police from your phone</small></span></a>
      <a className="emergency-call" href="tel:998"><Phone size={18} /><span><b>Ambulance · 998</b><small>Calls UAE ambulance from your phone</small></span></a>
      {booking && <button className="emergency-share" onClick={onShare}><Copy size={17} /><span><b>Share my live trip</b><small>{booking.pickup} → {booking.destination} · {booking.id}</small></span></button>}
    </div>
    <p className="modal-note">These buttons open your phone dialler. GoRide itself does not contact anyone in this demo.</p>
  </Modal>;
}

type RouteMode = "destination" | "stop" | "pickup";
export function RouteChangeModal({ booking, mode, city, onSave, onClose }: { booking: Booking; mode: RouteMode; city: string; onSave: (change: Partial<Booking>, note: string) => void; onClose: () => void }) {
  const initial = mode === "destination" ? booking.destination : mode === "pickup" ? booking.pickup : booking.stop ?? "";
  const [value, setValue] = useState(initial);
  const change = mode === "stop" ? { stop: value } : { [mode]: value };
  const preview = isPlace(value) ? priceRoute(booking, change) : null;
  const before = booking.distanceKm ?? routeKm(booking.pickup, booking.destination, booking.stop);
  const blocked = [booking.pickup, booking.destination, booking.stop ?? ""].filter((p) => p && p !== initial);
  const title = mode === "destination" ? "Change destination" : mode === "pickup" ? "Change pickup point" : booking.stop ? "Change your stop" : "Add a stop";
  const note = mode === "destination" ? `Destination changed to ${value}` : mode === "pickup" ? `Pickup moved to ${value}` : booking.stop ? `Stop changed to ${value}` : `Stop added at ${value}`;
  return <Modal title={title} onClose={onClose} icon={<MapPin size={17} />}>
    <div className="rider-form">
      <PlacePicker label={mode === "stop" ? "Stop on the way" : mode === "pickup" ? "New pickup" : "New destination"} value={value} onChange={setValue} exclude={blocked} city={city} autoFocus />
      {preview && value !== initial && <div className="route-preview">
        <div><span>Distance</span><b>{before.toFixed(1)} km → {preview.distanceKm.toFixed(1)} km</b></div>
        <div><span>Fare</span><b>AED {booking.fare.toFixed(2)} → AED {preview.fare.toFixed(2)}</b></div>
        {mode === "stop" && <small>Includes AED {STOP_FEE} stop fee. The driver will wait up to 3 minutes at the stop.</small>}
        {mode === "pickup" && <small>Your driver is re-routed to the new pickup point.</small>}
      </div>}
      <div className="rider-modal-actions">
        {mode === "stop" && booking.stop && <button className="btn-quiet danger" onClick={() => onSave({ stop: undefined, ...priceRoute(booking, { stop: undefined }) }, `Stop at ${booking.stop} removed`)}><Trash2 size={14} /> Remove stop</button>}
        <button className="btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!preview || value === initial} onClick={() => preview && onSave({ ...change, ...preview }, note)}>Confirm change</button>
      </div>
    </div>
  </Modal>;
}

export function EditScheduleModal({ ride, city, onSave, onCancelRide, onClose }: { ride: Booking; city: string; onSave: (b: Booking, when: Date) => void; onCancelRide: () => void; onClose: () => void }) {
  const parsed = useMemo(() => { const d = new Date(`${ride.date} ${new Date().getFullYear()}`); return Number.isNaN(d.getTime()) ? new Date(Date.now() + 86400000) : d; }, [ride.date]);
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const [pickup, setPickup] = useState(ride.pickup);
  const [destination, setDestination] = useState(ride.destination);
  const [stop, setStop] = useState(ride.stop ?? "");
  const [when, setWhen] = useState(local);
  const [rideId, setRideId] = useState(rideIdOf(ride));
  const valid = isPlace(pickup) && isPlace(destination) && pickup !== destination && (!stop || isPlace(stop)) && new Date(when).getTime() > Date.now();
  const km = valid ? routeKm(pickup, destination, stop || undefined) : 0;
  const fare = valid ? Math.round((estimateFare(rideId, km) + (stop ? STOP_FEE : 0)) * 100) / 100 : 0;
  return <Modal title={`Edit ${ride.id}`} onClose={onClose} icon={<CalendarDays size={17} />} wide>
    <div className="rider-form">
      <div className="rider-form-row"><PlacePicker label="Pickup" value={pickup} onChange={setPickup} city={city} /><PlacePicker label="Destination" value={destination} onChange={setDestination} city={city} /></div>
      <PlacePicker label="Stop on the way (optional)" value={stop} onChange={setStop} city={city} exclude={[pickup, destination]} />
      <div className="rider-form-row"><label>Date & time<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label><label>Ride type<select value={rideId} onChange={(e) => setRideId(e.target.value)}>{rideTypes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
      {valid ? <div className="route-preview"><div><span>Distance</span><b>{km.toFixed(1)} km</b></div><div><span>Estimated fare</span><b>AED {fare.toFixed(2)}</b></div></div> : <small className="modal-note">Choose two different places from the list and a time in the future.</small>}
      <div className="rider-modal-actions"><button className="btn-quiet danger" onClick={onCancelRide}><Trash2 size={14} /> Cancel ride</button><button className="btn-quiet" onClick={onClose}>Close</button><button className="btn-primary" disabled={!valid} onClick={() => { const r = rideTypes.find((x) => x.id === rideId)!; onSave({ ...ride, pickup, destination, stop: stop || undefined, rideId, category: r.name, distanceKm: km, fare, date: fmtDate(new Date(when)) }, new Date(when)); }}>Save changes</button></div>
    </div>
  </Modal>;
}

export function TransactionsPage({ data, onTopUp }: { data: RiderData; onTopUp: () => void }) {
  const t = useT();
  const [kind, setKind] = useState("All");
  const [q, setQ] = useState("");
  const rows = [
    ...data.trips.filter((x) => x.status === "Completed").map((x) => ({ id: x.id, title: `${x.category} · ${x.pickup} → ${x.destination}`, date: x.date, amount: -x.fare, kind: "Rides", method: x.payment ?? "" })),
    ...data.topups.map((x) => ({ id: x.id, title: "Wallet top-up", date: x.date, amount: x.amount, kind: "Top-ups", method: x.method })),
    ...(data.credits ? [{ id: "credit", title: "Ride credit · reward", date: "", amount: data.credits, kind: "Credits", method: "GoRide" }] : []),
  ].filter((r) => (kind === "All" || r.kind === kind) && `${r.title} ${r.method}`.toLowerCase().includes(q.toLowerCase()));
  const spent = rows.filter((r) => r.amount < 0).reduce((a, r) => a - r.amount, 0);
  return <div className="transactions-page">
    <div className="page-heading"><div><div className="eyebrow">PAYMENTS · HISTORY</div><h1>{t("Every dirham, accounted for.")}</h1><p>All rides, top-ups and credits on your account.</p></div><div className="heading-actions"><Link className="btn-quiet" to="/wallet">Back to wallet</Link><button className="btn-primary" onClick={onTopUp}><Plus size={15} /> Top up</button></div></div>
    <div className="trip-controls"><div className="trip-search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search transactions" /></div><div className="segmented">{["All", "Rides", "Top-ups", "Credits"].map((k) => <button key={k} className={kind === k ? "active" : ""} onClick={() => setKind(k)}>{k}</button>)}</div></div>
    <div className="panel transactions">
      <div className="txn-summary"><span>{rows.length} transactions</span><span>Spent on rides: <b>AED {spent.toFixed(2)}</b></span><span>Wallet balance: <b>AED {data.wallet.toFixed(2)}</b></span></div>
      {rows.map((r) => <div className="transaction-row" key={r.id}><span className={`transaction-symbol ${r.amount < 0 ? "debit" : "credit"}`}>{r.amount < 0 ? <CreditCard size={16} /> : <Wallet size={16} />}</span><span><b>{r.title}</b><small>{[r.date, r.method].filter(Boolean).join(" · ")}</small></span><strong className={r.amount > 0 ? "positive" : ""}>{r.amount > 0 ? "+" : "−"} AED {Math.abs(r.amount).toFixed(2)}</strong></div>)}
      {!rows.length && <div className="empty-inline"><b>No transactions match</b><span>Try another filter.</span></div>}
    </div>
  </div>;
}

export function SupportPage({ data, onSubmit, onClose }: { data: RiderData; onSubmit: (t: Ticket) => void; onClose: (id: string) => void }) {
  const t = useT();
  const [sent, setSent] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    if ((f.message ?? "").trim().length < 10) return;
    const id = `T-${Math.floor(1100 + Math.random() * 8800)}`;
    onSubmit({ id, topic: f.topic, message: f.message.trim(), tripId: f.tripId || undefined, date: fmtDate(new Date()), status: "Open" });
    setSent(id);
    e.currentTarget.reset();
  };
  return <div className="support-page">
    <div className="page-heading"><div><div className="eyebrow">HELP CENTRE</div><h1>{t("How can we help?")}</h1><p>Send us a message and track the answer here.</p></div></div>
    <div className="support-grid">
      <form className="panel rider-form support-form" onSubmit={submit}>
        <div className="panel-heading"><span className="panel-icon"><Headphones size={18} /></span><div><h3>Contact support</h3><p>We usually reply within an hour.</p></div></div>
        <label>Topic<select name="topic"><option>Problem with a ride</option><option>Lost item</option><option>Receipt / billing</option><option>Safety concern</option><option>Account</option><option>Something else</option></select></label>
        <label>Related trip <em>(optional)</em><select name="tripId"><option value="">No specific trip</option>{data.trips.slice(0, 12).map((x) => <option key={x.id} value={x.id}>{x.id} · {x.pickup} → {x.destination}</option>)}</select></label>
        <label>Message<textarea name="message" rows={5} minLength={10} required placeholder="Tell us what happened…" /></label>
        {sent && <div className="admin-notice">Ticket {sent} sent. You'll see the reply below.</div>}
        <button className="btn-primary full-btn"><Send size={15} /> Send message</button>
        <small className="modal-note">Demo support · replies are automatic.</small>
      </form>
      <div className="panel ticket-list">
        <div className="section-title"><h2>Your tickets</h2><span className="count-pill">{data.tickets.length}</span></div>
        {data.tickets.map((x) => <div className="ticket" key={x.id}><div className="ticket-top"><b>{x.id} · {x.topic}</b><span className={`status-chip ${x.status === "Open" ? "scheduled-chip" : x.status === "Answered" ? "progress-chip" : "complete-chip"}`}>{x.status}</span></div><small>{x.date}{x.tripId ? ` · ${x.tripId}` : ""}</small><p>{x.message}</p>{x.reply && <div className="ticket-reply"><b>GoRide support</b><p>{x.reply}</p></div>}{x.status !== "Closed" && <button className="text-link" onClick={() => onClose(x.id)}><Check size={13} /> Mark as solved</button>}</div>)}
        {!data.tickets.length && <div className="empty-inline"><b>No tickets yet</b><span>Messages you send will appear here.</span></div>}
        <Link className="text-link" to="/safety">Safety tips & FAQs <ArrowRight size={14} /></Link>
      </div>
    </div>
  </div>;
}
