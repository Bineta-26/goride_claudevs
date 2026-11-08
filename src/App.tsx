import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownUp, ArrowLeft, ArrowRight, BadgeCheck, Bell, CalendarDays, CarFront, Check, ChevronDown, ChevronRight,
  CircleHelp, Clock3, CreditCard, Download, Ellipsis, Headphones, Heart, Home, Leaf, MapPin, Menu, MessageCircle,
  Navigation, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, Wallet, X, Zap, Pencil, Trash2, Briefcase, Route as RouteIcon, KeyRound,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import MapPanel from "./MapPanel";
import { AuthPage, ChangePasswordPanel, ForgotPasswordPage, ResetPasswordPage, initials, useAuth } from "./Auth";

const AdminPortal = lazy(() => import("./Admin"));
import { estimateFare, getRouteDistanceKm, places, rideTypes, type Booking } from "./data";
import { methodLabel, newId, useRiderData, fmtDate, type Notice, type PaymentMethod, type RiderData, type SavedPlace } from "./riderData";
import { LangContext, tr, useT } from "./i18n";
import {
  AddMethodModal, CallModal, ChatModal, CityMenu, EditScheduleModal, EmergencyModal, LanguageModal, NotificationsMenu, ReceiptModal,
  RouteChangeModal, SavedPlaceModal, SupportPage, TopUpModal, TransactionsPage, shareTrip,
} from "./RiderUI";

type Toast = { text: string; tone?: "success" | "info" };
const navItems = [
  { path: "/dashboard", label: "Overview", icon: Home },
  { path: "/book", label: "Book a ride", icon: Navigation },
  { path: "/trips", label: "Your trips", icon: Clock3 },
  { path: "/scheduled", label: "Scheduled", icon: CalendarDays },
  { path: "/wallet", label: "Payments", icon: Wallet },
];
const earnings = [{ day: "Mon", value: 240 }, { day: "Tue", value: 315 }, { day: "Wed", value: 270 }, { day: "Thu", value: 390 }, { day: "Fri", value: 340 }, { day: "Sat", value: 490 }, { day: "Sun", value: 425 }];

function localDateTimeValue(date: Date) {
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}

function Logo({ small = false }: { small?: boolean }) {
  return <Link to="/dashboard" className={`brand ${small ? "brand-small" : ""}`} aria-label="GoRide home"><span className="brand-mark"><Navigation size={19} fill="currentColor" /></span><span>GoRide</span><sup>®</sup></Link>;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, loading } = useAuth();
  const { data, update } = useRiderData(user?.id, user?.email, !loading);
  const field = <K extends keyof RiderData>(k: K) => (v: RiderData[K] | ((prev: RiderData[K]) => RiderData[K])) =>
    update((d) => ({ ...d, [k]: typeof v === "function" ? (v as (prev: RiderData[K]) => RiderData[K])(d[k]) : v }));
  const t = (text: string) => tr(data.lang, text);
  const userInitials = user ? initials(user.fullName) : "";
  const [toast, setToast] = useState<Toast | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickup, setPickup] = useState("Dubai Marina");
  const [destination, setDestination] = useState("Downtown Dubai");
  const [laterDateTime, setLaterDateTime] = useState(() => localDateTimeValue(new Date(Date.now() + 86400000)));
  const [scheduledPickUp, setScheduledPickUp] = useState("");
  const [rideId, setRideId] = useState("comfort");
  const [promo, setPromo] = useState(false);
  const [promoText, setPromoText] = useState("");
  const defaultMethod = data.methods.find((m) => m.isDefault) ?? data.methods[0];
  const [payment, setPayment] = useState(defaultMethod ? methodLabel(defaultMethod) : "Cash");
  useEffect(() => { setPayment(defaultMethod ? methodLabel(defaultMethod) : "Cash"); }, [defaultMethod?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const booking = data.active, setBooking = field("active");
  const trips = data.trips, setTrips = field("trips");
  const schedule = data.schedule, setSchedule = field("schedule");
  const walletBalance = data.wallet, setWalletBalance = field("wallet");
  const darkMode = data.darkMode, setDarkMode = field("darkMode");
  const [filter, setFilter] = useState("All trips");
  const [panel, setPanel] = useState<"notices" | "city" | null>(null);
  const [modal, setModal] = useState<
    | { kind: "receipt"; trip: Booking } | { kind: "chat" } | { kind: "call" } | { kind: "emergency" } | { kind: "addMethod" } | { kind: "topUp" }
    | { kind: "place"; place: SavedPlace | null } | { kind: "language" } | { kind: "route"; mode: "destination" | "stop" | "pickup" } | { kind: "editSchedule"; ride: Booking }
    | null>(null);
  const closeModal = () => setModal(null);
  const notify = (title: string, body: string, link?: string) => { if (data.notifyRides) field("notices")((n) => [{ id: newId(), title, body, time: fmtDate(new Date()), read: false, link }, ...n].slice(0, 30)); };
  const [driverOnline, setDriverOnline] = useState(false);
  const [requestAccepted, setRequestAccepted] = useState(false);
  const [driverEarnings, setDriverEarnings] = useState(486.5);
  const [driverCompletedRides, setDriverCompletedRides] = useState(12);
  const [trackingProgress, setTrackingProgress] = useState(0.35);
  const [matching, setMatching] = useState(false);

  useEffect(() => { document.documentElement.lang = data.lang; }, [data.lang]);
  useEffect(() => { document.documentElement.dataset.theme = darkMode ? "dark" : "light"; }, [darkMode]);
  useEffect(() => {
    if (!booking || booking.status !== "In progress") return;
    const timer = window.setInterval(() => setTrackingProgress((value) => Math.min(value + 0.012, 0.92)), 1800);
    return () => window.clearInterval(timer);
  }, [booking]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const announce = (text: string, tone: Toast["tone"] = "success") => setToast({ text, tone });
  const distanceKm = getRouteDistanceKm(pickup, destination);
  const fare = estimateFare(rideId, distanceKm, promo);
  const selectedRide = rideTypes.find((ride) => ride.id === rideId) ?? rideTypes[1];
  const currentTitle = location.pathname === "/wallet/transactions" ? "Transactions" : navItems.find((item) => location.pathname.startsWith(item.path))?.label ??
    (location.pathname === "/driver" ? "Driver mode" : location.pathname === "/confirm" ? "Confirm your ride" : location.pathname === "/tracking" ? "On your way" : location.pathname === "/profile" ? "Profile & settings" : location.pathname === "/support" ? "Support" : location.pathname === "/wallet/transactions" ? "Transactions" : location.pathname === "/safety" ? "Safety & support" : location.pathname === "/signup" ? "Create account" : location.pathname === "/login" ? "Log in" : location.pathname === "/forgot-password" || location.pathname === "/reset-password" ? "Reset password" : "Your ride, your way");

  const makeBooking = (status: Booking["status"], id = `GR-${Math.floor(2000 + Math.random() * 7000)}`): Booking => ({
    id, pickup, destination, category: selectedRide.name, rideId: selectedRide.id, distanceKm, changes: [], fare, payment, date: `Today, ${new Date().toLocaleTimeString("en-AE", { hour: "numeric", minute: "2-digit" })}`, status,
  });
  const startMatching = () => {
    if (!pickup.trim() || !destination.trim() || pickup === destination) {
      announce(pickup === destination ? "Choose two different locations to continue." : "Add a pickup and destination to continue.", "info");
      return;
    }
    setMatching(true);
    window.setTimeout(() => {
      const newBooking = makeBooking("In progress");
      setBooking(newBooking);
      setTrips((current) => [newBooking, ...current]);
      setTrackingProgress(0.24);
      setMatching(false);
      announce("Your demo driver is on the way!");
      notify("Driver on the way", `Rashid is heading to ${newBooking.pickup} in a White Tesla Model 3.`, "/tracking");
      navigate("/tracking");
    }, 1400);
  };
  const finishRide = () => {
    if (!booking) return;
    setTrips((current) => current.map((trip) => trip.id === booking.id ? { ...booking, status: "Completed" } : trip));
    notify(`Receipt for ${booking.id}`, `${booking.pickup} → ${booking.destination}: AED ${booking.fare.toFixed(2)}.`, "/trips");
    if (booking.payment === "GoRide Wallet") {
      setWalletBalance((value) => Math.round(Math.max(0, value - booking.fare) * 100) / 100);
    }
    setBooking(null);
    setTrackingProgress(0.35);
    announce("Trip completed. A demo receipt is ready in Your trips.");
    navigate("/trips");
  };
  const cancelRide = () => {
    if (!booking || !window.confirm("Cancel this demo ride?")) return;
    setTrips((current) => current.map((trip) => trip.id === booking.id ? { ...trip, status: "Cancelled" } : trip));
    setBooking(null);
    announce("Demo ride cancelled.", "info");
    navigate("/dashboard");
  };
  const scheduleRide = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pickup === destination) { announce("Choose different pickup and destination locations.", "info"); return; }
    const formData = new FormData(event.currentTarget);
    const plannedDate = formData.get("scheduledDate");
    const plannedTime = formData.get("scheduledTime");
    if (typeof plannedDate !== "string" || typeof plannedTime !== "string") {
      announce("Choose a date and pickup time for your reservation.", "info");
      return;
    }
    const departure = new Date(`${plannedDate}T${plannedTime}`);
    if (Number.isNaN(departure.getTime()) || departure.getTime() <= Date.now()) {
      announce("Choose a pickup time in the future.", "info");
      return;
    }
    const future = makeBooking("Scheduled", `GR-${Math.floor(3000 + Math.random() * 6000)}`);
    future.date = departure.toLocaleString("en-AE", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    setSchedule((current) => [future, ...current]);
    setScheduledPickUp("");
    announce("Your demo ride has been scheduled.");
    notify("Ride scheduled", `${future.pickup} → ${future.destination} on ${future.date}.`, "/scheduled");
  };
  const changeRoute = (change: Partial<Booking>, note: string) => {
    if (!booking) return;
    const next: Booking = { ...booking, ...change, changes: [...(booking.changes ?? []), `${new Date().toLocaleTimeString("en-AE", { hour: "numeric", minute: "2-digit" })} · ${note}`] };
    if (!next.stop) delete next.stop;
    setBooking(next);
    setTrips((current) => current.map((trip) => trip.id === next.id ? next : trip));
    if (change.pickup) setTrackingProgress(0.12);
    closeModal();
    announce(`${note}. New fare AED ${next.fare.toFixed(2)}.`);
    notify("Route updated", `${note}. Fare is now AED ${next.fare.toFixed(2)}.`, "/tracking");
  };
  const openNotice = (n: Notice) => { field("notices")((list) => list.map((x) => x.id === n.id ? { ...x, read: true } : x)); setPanel(null); if (n.link) navigate(n.link); };
  const saveMethod = (m: PaymentMethod) => { field("methods")((list) => [...(m.isDefault ? list.map((x) => ({ ...x, isDefault: false })) : list), m]); closeModal(); announce(`${methodLabel(m)} added.`); };
  const share = async (b: Booking | null) => announce(b ? await shareTrip(b) : "Start a ride to share your live trip.", "info");
  const unread = data.notices.filter((n) => !n.read).length;
  const navToBook = () => navigate("/book");
  const swapLocations = () => { setPickup(destination); setDestination(pickup); };

  if (location.pathname.startsWith("/admin/")) {
    return <Suspense fallback={null}><Routes><Route path="/admin/:key" element={<AdminPortal />} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></Suspense>;
  }

  return (
    <LangContext.Provider value={data.lang}>
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top"><Logo /><button className="icon-btn sidebar-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
        <div className="demo-pill"><span /> DEMO PROTOTYPE</div>
        <div className="sidebar-label">{t("MENU")}</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ path, label, icon: Icon }) => <Link key={path} to={path} onClick={() => setMenuOpen(false)} className={`nav-link ${location.pathname === path ? "active" : ""}`}><Icon size={18} strokeWidth={1.8} /><span>{t(label)}</span>{label === "Book a ride" && <span className="nav-shortcut">⌘ B</span>}</Link>)}
        </nav>
        <div className="sidebar-label more-label">{t("MORE")}</div>
        <nav className="side-nav">
          <Link to="/driver" onClick={() => setMenuOpen(false)} className={`nav-link ${location.pathname === "/driver" ? "active" : ""}`}><CarFront size={18} /><span>{t("Driver mode")}</span><span className="driver-tag">NEW</span></Link>
          <Link to="/safety" onClick={() => setMenuOpen(false)} className={`nav-link ${location.pathname === "/safety" ? "active" : ""}`}><ShieldCheck size={18} /><span>{t("Safety & support")}</span></Link>
          <Link to="/support" onClick={() => setMenuOpen(false)} className={`nav-link ${location.pathname === "/support" ? "active" : ""}`}><Headphones size={18} /><span>{t("Support")}</span>{data.tickets.some((x) => x.status === "Answered") && <span className="driver-tag">REPLY</span>}</Link>
          <Link to="/profile" onClick={() => setMenuOpen(false)} className={`nav-link ${location.pathname === "/profile" ? "active" : ""}`}><Ellipsis size={18} /><span>{t("Profile & settings")}</span></Link>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-promo"><div className="promo-icon"><Sparkles size={18} /></div><strong>Good things<br />come with rides.</strong><p>Enjoy 15% off your next trip.</p><button onClick={() => { setPromo(true); setPromoText("RIDE15"); announce("RIDE15 applied to your next booking."); }}>Apply RIDE15 <ArrowRight size={14} /></button></div>
        {user ? <button className="profile-mini" onClick={() => navigate("/profile")}><div className="avatar">{userInitials}</div><span className="profile-mini-copy"><b>{user.fullName}</b><small>{user.role === "driver" ? "Driver account" : "Rider account"}</small></span><ChevronDown size={16} /></button> : <div className="sidebar-auth"><Link className="btn-primary" to="/signup" onClick={() => setMenuOpen(false)}>Create account</Link><Link className="sidebar-login" to="/login" onClick={() => setMenuOpen(false)}>Log in</Link></div>}
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>GoRide</span><ChevronRight size={14} /><b>{t(currentTitle)}</b></div>
          <div className="topbar-actions"><div className="pop-anchor"><button className="city-chip" onClick={() => setPanel(panel === "city" ? null : "city")} aria-label="Change city"><span className="live-dot" /> {data.city}, UAE <ChevronDown size={14} /></button>{panel === "city" && <CityMenu city={data.city} onClose={() => setPanel(null)} onPick={(c) => { field("city")(c); setPanel(null); announce(`Showing places in ${c} first.`, "info"); }} />}</div><div className="pop-anchor"><button className="icon-btn notification-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} onClick={() => setPanel(panel === "notices" ? null : "notices")}><Bell size={18} />{unread > 0 && <i />}</button>{panel === "notices" && <NotificationsMenu notices={data.notices} onOpen={openNotice} onClose={() => setPanel(null)} onMarkAll={() => field("notices")((list) => list.map((x) => ({ ...x, read: true })))} onClear={() => { field("notices")([]); setPanel(null); }} />}</div>{user ? <button className="top-avatar" aria-label="Open profile" onClick={() => navigate("/profile")}>{userInitials}</button> : <Link className="top-login" to="/login">Log in</Link>}</div>
        </header>
        <div className="page-content">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.22 }}>
              <Routes>
                <Route path="/" element={<LandingPage pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} goBook={navToBook} goDriver={() => navigate(user?.role === "driver" ? "/driver" : "/signup?role=driver")} />} />
                <Route path="/dashboard" element={<Dashboard goBook={navToBook} pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} announce={announce} fare={fare} balance={walletBalance} schedule={schedule} data={data} name={user?.fullName.split(" ")[0] ?? "there"} useCredits={() => { if (data.credits > 0) { setPromo(true); announce(`AED ${data.credits} credit ready · RIDE15 applied too.`); } else announce("You have no ride credits right now. RIDE15 applied instead."); setPromo(true); setPromoText("RIDE15"); navToBook(); }} />} />
                <Route path="/book" element={<BookingPage saved={data.saved} promo={promo} onPromo={() => { setPromo(true); setPromoText("RIDE15"); announce("RIDE15 applied · 15% off this ride."); }} pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} swap={swapLocations} rideId={rideId} setRideId={setRideId} fare={fare} distanceKm={distanceKm} laterDateTime={laterDateTime} setLaterDateTime={setLaterDateTime} onContinue={(when, plannedTime) => {
                  if (when === "Later") {
                    if (new Date(plannedTime).getTime() <= Date.now()) { announce("Choose a pickup time in the future.", "info"); return; }
                    setScheduledPickUp(plannedTime);
                    navigate("/scheduled");
                  } else {
                    navigate("/confirm");
                  }
                }} />} />
                <Route path="/confirm" element={<ConfirmPage pickup={pickup} destination={destination} selectedRide={selectedRide} fare={fare} distanceKm={distanceKm} promo={promo} setPromo={setPromo} promoText={promoText} setPromoText={setPromoText} payment={payment} setPayment={setPayment} methods={data.methods} matching={matching} announce={announce} onConfirm={startMatching} onBack={() => navigate("/book")} />} />
                <Route path="/tracking" element={<TrackingPage booking={booking} progress={trackingProgress} onFinish={finishRide} onCancel={cancelRide} onRoute={(mode) => setModal({ kind: "route", mode })} onChat={() => setModal({ kind: "chat" })} onCall={() => setModal({ kind: "call" })} onShare={() => share(booking)} />} />
                <Route path="/trips" element={<TripsPage trips={trips} filter={filter} setFilter={setFilter} onReceipt={(trip) => setModal({ kind: "receipt", trip })} onRebook={(trip) => { setPickup(trip.pickup); setDestination(trip.destination); setRideId(trip.rideId ?? rideId); navToBook(); }} />} />
                <Route path="/scheduled" element={<ScheduledPage schedule={schedule} pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} rideId={rideId} setRideId={setRideId} plannedDateTime={scheduledPickUp} onSubmit={scheduleRide} onCancel={(id) => { setSchedule((items) => items.filter((trip) => trip.id !== id)); announce("Scheduled demo ride cancelled.", "info"); }} onEdit={(ride) => setModal({ kind: "editSchedule", ride })} />} />
                <Route path="/wallet" element={<WalletPage balance={walletBalance} promo={promo} setPromo={setPromo} trips={trips} announce={announce} data={data}
                  onAdd={() => setModal({ kind: "addMethod" })} onTopUp={() => setModal({ kind: "topUp" })}
                  onDefault={(m) => { field("methods")((list) => list.map((x) => ({ ...x, isDefault: x.id === m.id }))); announce(`${methodLabel(m)} is now your default.`); }}
                  onRemove={(m) => { field("methods")((list) => { const rest = list.filter((x) => x.id !== m.id); return m.isDefault && rest[0] ? rest.map((x, i) => ({ ...x, isDefault: i === 0 })) : rest; }); announce(`${methodLabel(m)} removed.`, "info"); }} />} />
                <Route path="/wallet/transactions" element={<TransactionsPage data={data} onTopUp={() => setModal({ kind: "topUp" })} />} />
                <Route path="/support" element={<SupportPage data={data} onClose={(id) => field("tickets")((list) => list.map((x) => x.id === id ? { ...x, status: "Closed" } : x))} onSubmit={(ticket) => {
                  field("tickets")((list) => [ticket, ...list]);
                  window.setTimeout(() => { field("tickets")((list) => list.map((x) => x.id === ticket.id ? { ...x, status: "Answered", reply: `Thanks for reaching out about "${ticket.topic.toLowerCase()}". A GoRide specialist has reviewed your message${ticket.tripId ? ` and trip ${ticket.tripId}` : ""} and will follow up by email within 24 hours.` } : x)); notify(`Reply on ${ticket.id}`, "GoRide support answered your message.", "/support"); }, 6000);
                }} />} />
                <Route path="/driver" element={<DriverPage online={driverOnline} setOnline={setDriverOnline} accepted={requestAccepted} setAccepted={setRequestAccepted} earnings={driverEarnings} completedRides={driverCompletedRides} onComplete={() => { setDriverEarnings((value) => Math.round((value + 46.5) * 100) / 100); setDriverCompletedRides((value) => value + 1); }} announce={announce} />} />
                <Route path="/profile" element={<ProfilePage announce={announce} darkMode={darkMode} setDarkMode={setDarkMode} data={data} setNotify={(v) => field("notifyRides")(v)} defaultMethod={defaultMethod}
                  onPlace={(place) => setModal({ kind: "place", place })} onGo={(place) => { setDestination(place); navToBook(); }} onLanguage={() => setModal({ kind: "language" })} onLogout={async () => { await logout(); announce("You have been logged out.", "info"); navigate("/"); }} />} />
                <Route path="/safety" element={<SafetyPage onEmergency={() => setModal({ kind: "emergency" })} onShare={() => share(booking)} />} />
                <Route path="/signup" element={<AuthPage mode="signup" />} />
                <Route path="/login" element={<AuthPage mode="login" />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.slice(0, 4).map(({ path, label, icon: Icon }) => <Link key={path} to={path} className={location.pathname === path ? "active" : ""}><Icon size={19} /><span>{t(label === "Overview" ? "Home" : label === "Book a ride" ? "Book" : label === "Your trips" ? "Trips" : label)}</span></Link>)}</nav>
      </main>
      <AnimatePresence>{toast && <motion.div className={`toast ${toast.tone ?? ""}`} initial={{ opacity: 0, y: 14, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}><span className="toast-check"><Check size={15} /></span>{toast.text}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></motion.div>}</AnimatePresence>
      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
      {modal?.kind === "receipt" && <ReceiptModal trip={modal.trip} rider={user?.fullName ?? "Guest rider"} onClose={closeModal} />}
      {modal?.kind === "chat" && <ChatModal driver="Rashid Khan" onClose={closeModal} />}
      {modal?.kind === "call" && <CallModal driver="Rashid Khan" onClose={closeModal} />}
      {modal?.kind === "emergency" && <EmergencyModal booking={booking} onShare={() => share(booking)} onClose={closeModal} />}
      {modal?.kind === "addMethod" && <AddMethodModal onSave={saveMethod} onClose={closeModal} />}
      {modal?.kind === "topUp" && <TopUpModal methods={data.methods} onClose={closeModal} onSave={(amount, method) => { update((d) => ({ ...d, wallet: Math.round((d.wallet + amount) * 100) / 100, topups: [{ id: newId(), date: fmtDate(new Date()), amount, method }, ...d.topups] })); closeModal(); announce(`AED ${amount} added to your wallet.`); }} />}
      {modal?.kind === "place" && <SavedPlaceModal place={modal.place} city={data.city} onClose={closeModal}
        onDelete={modal.place ? () => { field("saved")((list) => list.filter((x) => x.id !== modal.place!.id)); closeModal(); announce("Place removed.", "info"); } : undefined}
        onSave={(sp) => { field("saved")((list) => list.some((x) => x.id === sp.id) ? list.map((x) => x.id === sp.id ? sp : x) : [...list, sp]); closeModal(); announce(`${sp.label} saved.`); }} />}
      {modal?.kind === "language" && <LanguageModal lang={data.lang} onClose={closeModal} onPick={(l) => { field("lang")(l); closeModal(); announce(l === "ar" ? "تم تغيير اللغة إلى العربية" : "Language set to English."); }} />}
      {modal?.kind === "route" && booking && <RouteChangeModal booking={booking} mode={modal.mode} city={data.city} onClose={closeModal} onSave={changeRoute} />}
      {modal?.kind === "editSchedule" && <EditScheduleModal ride={modal.ride} city={data.city} onClose={closeModal}
        onCancelRide={() => { setSchedule((items) => items.filter((x) => x.id !== modal.ride.id)); closeModal(); announce(`${modal.ride.id} cancelled.`, "info"); }}
        onSave={(ride) => { setSchedule((items) => items.map((x) => x.id === ride.id ? ride : x)); closeModal(); announce(`${ride.id} updated.`); notify("Scheduled ride updated", `${ride.pickup} → ${ride.destination} on ${ride.date}.`, "/scheduled"); }} />}
    </div>
    </LangContext.Provider>
  );
}

function LandingAuthLinks() {
  const { user } = useAuth();
  if (user) return <Link to={user.role === "driver" ? "/driver" : "/dashboard"} className="landing-signin">Hi, {user.fullName.split(" ")[0]} <ArrowRight size={14} /></Link>;
  return <div className="landing-auth"><Link to="/login" className="landing-login">Log in</Link><Link to="/signup" className="landing-signin">Sign up <ArrowRight size={14} /></Link></div>;
}

function PageHeading({ eyebrow, title, copy, action }: { eyebrow?: string; title: string; copy?: string; action?: ReactNode }) {
  const t = useT();
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{t(title)}</h1>{copy && <p>{t(copy)}</p>}</div>{action}</div>;
}
function SectionTitle({ title, action }: { title: string; action?: ReactNode }) { const t = useT(); return <div className="section-title"><h2>{t(title)}</h2>{action}</div>; }

function LandingPage({ pickup, destination, setPickup, setDestination, goBook, goDriver }: { pickup: string; destination: string; setPickup: (v: string) => void; setDestination: (v: string) => void; goBook: () => void; goDriver: () => void }) {
  return <div className="landing-page">
    <div className="landing-nav"><Logo /><div className="landing-links"><a href="#why-goride">Why GoRide</a><a href="#destinations">Destinations</a><button onClick={goDriver}>Drive with us <ArrowRight size={14} /></button></div><LandingAuthLinks /></div>
    <section className="landing-hero">
      <div className="landing-copy"><div className="landing-overline"><span /> MOBILITY, MADE HUMAN</div><h1>Your ride.<br />Your time.<br /><em>Your journey.</em></h1><p>Reliable rides whenever and wherever you need them. Get there your way, with a little more ease in every mile.</p><div className="landing-book-card"><LocationFields pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} /><button className="btn-primary full-btn" onClick={goBook}>Find a Ride <ArrowRight size={16} /></button><div className="landing-card-foot"><ShieldCheck size={13} /> Thoughtful rides, transparent pricing</div></div><button className="driver-cta" onClick={goDriver}>Become a Driver <ArrowRight size={15} /></button></div>
      <div className="landing-visual"><div className="landing-visual-tag"><span className="live-dot" /> YOUR CITY, CONNECTED</div><div className="landing-map"><MapPanel pickup={pickup} destination={destination} /></div><div className="floating-route-card"><div className="route-card-icon"><Navigation size={17} /></div><div><b>A smoother way across Dubai</b><small>Your city is closer than you think.</small></div><span className="route-card-arrow"><ArrowRight size={15} /></span></div><div className="floating-eta"><span className="eta-spark">✦</span><b>18 <small>min</small></b><span>Estimated trip</span></div><div className="landing-orbit orbit-one" /><div className="landing-orbit orbit-two" /></div>
    </section>
    <section className="landing-stats"><div><b>2.4<span>m+</span></b><small>rides, and counting</small></div><i /><div><b>18<span>k</span></b><small>verified demo drivers</small></div><i /><div><b>12</b><small>cities made closer</small></div><i /><div><b>4.9<span>/5</span></b><small>happiness, measured</small></div></section>
    <section className="landing-destinations" id="destinations"><div><span className="eyebrow">A CITY OF POSSIBILITIES</span><h2>Where to, today?</h2></div><div className="landing-dest-list">{[{ name: "Dubai Marina", icon: "⌁", img: "dubai-marina" }, { name: "Downtown Dubai", icon: "◈", img: "downtown-dubai" }, { name: "Business Bay", icon: "⌂", img: "business-bay" }, { name: "JBR", icon: "◒", img: "jbr" }].map((place) => <button key={place.name} onClick={() => { setDestination(place.name); goBook(); }}><img className="dest-illustration" src={`/illustrations/${place.img}.webp`} alt={`Illustration of ${place.name}`} loading="lazy" /><span>{place.icon}</span><b>{place.name}</b><ArrowRight size={14} /></button>)}</div></section>
    <section className="landing-features" id="why-goride"><div className="landing-feature-intro"><span className="eyebrow">THE GO RIDE DIFFERENCE</span><h2>Good journeys<br />feel like <em>this.</em></h2><p>More than just getting there. It's the comfort of knowing the details are taken care of.</p></div><div className="landing-feature"><img className="feature-illustration" src="/illustrations/right-on-time.webp" alt="A GoRide car arriving on time for a waiting rider" loading="lazy" /><span className="feature-mark green"><Zap size={18} /></span><h3>Right on your time</h3><p>Effortless booking, clear arrival times, and rides that fit your day.</p><span>01</span></div><div className="landing-feature"><img className="feature-illustration" src="/illustrations/care-in-every-detail.webp" alt="A GoRide driver opening the car door for a passenger" loading="lazy" /><span className="feature-mark gold"><ShieldCheck size={18} /></span><h3>Care in every detail</h3><p>Thoughtful safety features and driver information, right when you need them.</p><span>02</span></div><div className="landing-feature"><img className="feature-illustration" src="/illustrations/price-without-mystery.webp" alt="A phone showing a clear upfront fare" loading="lazy" /><span className="feature-mark blue"><Leaf size={18} /></span><h3>Price, without mystery</h3><p>Know your estimated fare before you ride. No surprises, just clarity.</p><span>03</span></div></section>
    <footer className="landing-footer"><Logo small /><span>© 2026 GoRide · A mobility demo prototype. Rides and drivers are simulated.</span><button onClick={goDriver}>Drive with GoRide <ArrowRight size={13} /></button></footer>
  </div>;
}

function NextRideCard({ schedule }: { schedule: Booking[] }) {
  const next = schedule[0];
  const dateParts = next?.date.split(",") ?? [];
  const time = dateParts.length > 1 ? dateParts.pop()?.trim() : "Scheduled";
  const date = dateParts.join(",").trim();
  return <div className="next-ride-card">
    <div className="card-title-row"><div><span className="mini-kicker">UP NEXT</span><h3>{next ? "Your next ride" : "Nothing on the calendar"}</h3></div>{next && <span className="status-chip scheduled-chip">Scheduled</span>}</div>
    {next ? <>
      <div className="next-ride-time"><b>{time}</b><span className="next-ride-date">{date}</span></div>
      <div className="mini-route"><span className="route-start" /><div><b>{next.pickup}</b><small>Pickup</small></div><div className="route-line" /><span className="route-end" /><div><b>{next.destination}</b><small>{next.category} · Drop-off</small></div></div>
    </> : <div className="next-ride-empty"><p>Plan ahead and make your next day a little easier.</p></div>}
    <Link to="/scheduled" className="text-link">{next ? "View scheduled rides" : "Plan a ride"} <ArrowRight size={14} /></Link>
  </div>;
}

function LocationFields({ pickup, destination, setPickup, setDestination, swap }: { pickup: string; destination: string; setPickup: (value: string) => void; setDestination: (value: string) => void; swap?: () => void }) {
  const [suggest, setSuggest] = useState<"pickup" | "destination" | null>(null);
  const field = (type: "pickup" | "destination", value: string, setValue: (value: string) => void) => (
    <div className={`place-field ${suggest === type ? "place-field-focus" : ""}`}>
      <span className={`place-field-icon ${type}`}>{type === "pickup" ? <span /> : <MapPin size={16} />}</span>
      <div className="place-input-wrap"><label htmlFor={`place-${type}`}>{type === "pickup" ? "PICKUP" : "DROP-OFF"}</label><input id={`place-${type}`} value={value} onChange={(event) => setValue(event.target.value)} onFocus={() => setSuggest(type)} onBlur={() => window.setTimeout(() => setSuggest(null), 160)} placeholder={type === "pickup" ? "Where from?" : "Where to?"} autoComplete="off" />
        {suggest === type && <div className="suggestions">{places.filter((place) => !value || place.name.toLowerCase().includes(value.toLowerCase()) || place.detail.toLowerCase().includes(value.toLowerCase())).slice(0, 5).map((place) => <button key={place.name} onMouseDown={(event) => event.preventDefault()} onClick={() => { setValue(place.name); setSuggest(null); }}><span className="suggestion-icon"><MapPin size={15} /></span><span><b>{place.name}</b><small>{place.detail}</small></span></button>)}</div>}
      </div>
    </div>
  );
  return <div className="location-stack">{field("pickup", pickup, setPickup)}{swap && <button className="swap-locations" aria-label="Swap pickup and drop-off" onClick={swap}><ArrowDownUp size={16} /></button>}{field("destination", destination, setDestination)}</div>;
}

function Dashboard({ goBook, pickup, destination, setPickup, setDestination, fare, balance, schedule, data, name, useCredits }: { goBook: () => void; pickup: string; destination: string; setPickup: (v: string) => void; setDestination: (v: string) => void; announce: (v: string, t?: Toast["tone"]) => void; fare: number; balance: number; schedule: Booking[]; data: RiderData; name: string; useCredits: () => void }) {
  const t = useT();
  const navigate = useNavigate();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const month = new Intl.DateTimeFormat("en", { month: "short" }).format(new Date());
  const completed = data.trips.filter((x) => x.status === "Completed");
  const thisMonth = completed.filter((x) => x.date.includes(month)).length;
  const rated = completed.filter((x) => x.rating);
  const rating = rated.length ? rated.reduce((a, x) => a + (x.rating ?? 0), 0) / rated.length : 0;
  const recent = data.trips.filter((x, i, all) => all.findIndex((y) => y.destination === x.destination) === i).slice(0, 3);
  return <div className="dashboard-page">
    <div className="welcome-row"><div><div className="eyebrow">{new Date().toLocaleDateString("en-AE", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()} <span className="eyebrow-dot" /> YOUR CITY, YOUR CALL</div><h1>{t(greeting)}, {name} <span className="wave">✦</span></h1><p>{t("Where will the day take you?")}</p></div><div className="round-weather" aria-label="Current conditions"><span>☀</span><b>29°</b><small>Sunny in {data.city}</small></div></div>
    <div className="dashboard-grid">
      <section className="map-booking-card"><MapPanel pickup={pickup} destination={destination} /><div className="map-booking-panel"><div className="map-panel-heading"><span className="mini-kicker">LET'S GET MOVING</span><span className="secure-label"><ShieldCheck size={13} /> Safe by design</span></div><h2>Where to, {name}?</h2><LocationFields pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} />{data.saved.length > 0 && <SavedChips saved={data.saved} onPick={setDestination} />}<button className="btn-primary full-btn" onClick={goBook}>{t("Find a ride")} <ArrowRight size={17} /></button><div className="fare-estimate"><span>Estimated fare from</span><b>AED {fare.toFixed(0)}</b></div></div></section>
      <div className="dashboard-aside">
        <div className="wallet-card"><div className="wallet-card-top"><span className="wallet-icon"><Wallet size={19} /></span><button aria-label="Wallet options" className="icon-btn light-icon" onClick={() => navigate("/wallet")}><Ellipsis size={20} /></button></div><span className="wallet-overline">YOUR WALLET</span><strong>AED {balance.toFixed(2)}</strong><div className="wallet-bottom"><span>{data.credits ? `+ AED ${data.credits.toFixed(2)} in ride credits` : "No ride credits"}</span><Link to="/wallet">Manage <ArrowRight size={13} /></Link></div><div className="wallet-glow" /></div>
        <NextRideCard schedule={schedule} />
        <div className="support-mini"><span className="support-icon"><Headphones size={18} /></span><div><b>We're here for you</b><small>Get help anytime, anywhere.</small></div><Link to="/support" aria-label="Go to support"><ArrowRight size={17} /></Link></div>
      </div>
    </div>
    <div className="stats-strip"><div><span className="stat-icon mint"><Navigation size={16} /></span><span><b>{thisMonth}</b><small>Rides this month</small></span><Link to="/trips" className="stat-link">History <ArrowRight size={13} /></Link></div><div><span className="stat-icon peach"><Heart size={16} /></span><span><b>{rating ? rating.toFixed(1) : "—"}</b><small>Average rating you gave</small></span><span className="stat-stars">{rating ? "★".repeat(Math.round(rating)) : ""}</span></div><div><span className="stat-icon violet"><Zap size={16} /></span><span><b>{Math.floor(completed.length / 3)}</b><small>Rewards unlocked</small></span><Link to="/wallet" className="stat-link">View rewards <ArrowRight size={13} /></Link></div></div>
    <div className="dashboard-bottom"><section className="recent-section"><SectionTitle title="Recent destinations" action={<Link className="text-link" to="/trips">{t("See all")} <ArrowRight size={14} /></Link>} /><div className="destination-list">{recent.length ? recent.map((item) => <button className="destination-row" key={item.destination} onClick={() => { setPickup(item.pickup); setDestination(item.destination); goBook(); }}><span className="destination-symbol bag"><MapPin size={15} /></span><span><b>{item.destination}</b><small>From {item.pickup} · {item.date}</small></span><span className="destination-distance">~ {Math.max(5, Math.round((item.distanceKm ?? getRouteDistanceKm(item.pickup, item.destination)) * 1.25))} min</span><ChevronRight size={16} /></button>) : <div className="empty-inline"><b>No trips yet</b><span>Your recent destinations will show here.</span></div>}</div></section><section className="promo-card"><div className="promo-card-content"><div className="promo-badge"><Sparkles size={14} /> A LITTLE THANK YOU</div><h3>Your next trip<br />is on <em>us.</em></h3><p>{data.credits ? `You have AED ${data.credits} in ride credits waiting.` : "Use RIDE15 for 15% off your next ride."}</p><button className="btn-dark" onClick={useCredits}>{data.credits ? "Use my credits" : "Apply RIDE15"} <ArrowRight size={15} /></button></div><div className="promo-art"><span className="promo-sun" /><span className="promo-road" /><span className="promo-car"><CarFront size={31} /></span><span className="promo-art-spark">✦</span></div></section></div>
    <div className="prototype-note"><ShieldCheck size={14} /> GoRide is a demo prototype. Drivers, fares, and trip activity are simulated.</div>
  </div>;
}

function SavedChips({ saved, onPick }: { saved: SavedPlace[]; onPick: (place: string) => void }) {
  return <div className="saved-chips">{saved.map((p) => <button key={p.id} type="button" onClick={() => onPick(p.place)} title={p.place}>{p.icon === "home" ? <Home size={13} /> : p.icon === "work" ? <Briefcase size={13} /> : <Star size={13} />} {p.label}</button>)}</div>;
}

function BookingPage({ saved, promo, onPromo, pickup, destination, setPickup, setDestination, swap, rideId, setRideId, fare, distanceKm, laterDateTime, setLaterDateTime, onContinue }: { saved: SavedPlace[]; promo: boolean; onPromo: () => void; pickup: string; destination: string; setPickup: (v: string) => void; setDestination: (v: string) => void; swap: () => void; rideId: string; setRideId: (v: string) => void; fare: number; distanceKm: number; laterDateTime: string; setLaterDateTime: (v: string) => void; onContinue: (when: string, plannedTime: string) => void }) {
  const [when, setWhen] = useState("Now");
  return <div className="booking-page">
    <PageHeading eyebrow="BOOK A RIDE · STEP 1 OF 2" title="Let's get you there." copy="Every great journey starts with a destination." action={<div className="booking-steps"><span className="step-active">01</span><i /><span>02</span></div>} />
    <div className="booking-layout">
      <div className="booking-main">
        <section className="panel location-panel"><div className="panel-heading"><span className="panel-icon"><MapPin size={18} /></span><div><h3>Your route</h3><p>Choose your pickup and drop-off points</p></div><span className="verified-chip"><BadgeCheck size={14} /> Smart suggestions</span></div><LocationFields pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} swap={swap} />{saved.length > 0 && <SavedChips saved={saved} onPick={setDestination} />}<div className="route-summary"><span><Navigation size={15} /> {distanceKm.toFixed(1)} km</span><span><Clock3 size={15} /> About {Math.max(5, Math.round(distanceKm * 1.25))} min</span><span className="route-traffic"><span /> Typical conditions · demo estimate</span></div></section>
        <div className="map-booking-view"><MapPanel pickup={pickup} destination={destination} /></div>
        <section className="panel choose-panel"><div className="panel-heading"><span className="panel-icon lime"><CarFront size={18} /></span><div><h3>Choose your ride</h3><p>There's a perfect ride for every kind of day.</p></div></div><RideChoices rideId={rideId} setRideId={setRideId} fare={fare} distanceKm={distanceKm} /></section>
      </div>
      <aside className="booking-summary">
        <div className="summary-map-strip"><div className="summary-route-graphic"><span /><i /><span /></div><div><b>{pickup}</b><small>Pickup location</small></div><div className="summary-divider" /><div><b>{destination}</b><small>Drop-off location</small></div></div>
        <div className="panel summary-panel">
          <h3>When should we pick you up?</h3>
          <div className="when-toggle"><button className={when === "Now" ? "selected" : ""} onClick={() => setWhen("Now")}><Zap size={15} />Now</button><button className={when === "Later" ? "selected" : ""} onClick={() => setWhen("Later")}><CalendarDays size={15} />Later</button></div>
          {when === "Later" && <input className="datetime-input" aria-label="Scheduled pickup time" type="datetime-local" min={localDateTimeValue(new Date())} value={laterDateTime} onChange={(event) => setLaterDateTime(event.target.value)} />}
          <div className="summary-total"><span>Estimated total</span><b>AED {fare.toFixed(2)}</b></div>
          <div className="summary-meta"><span><ShieldCheck size={15} /> Upfront pricing</span><span>Includes all fees</span></div>
          <button className="btn-primary full-btn" onClick={() => onContinue(when, laterDateTime)}>{when === "Later" ? "Choose scheduled pickup" : "Review your ride"} <ArrowRight size={16} /></button>
          <div className="cancel-note"><Check size={13} /> Cancel anytime before your driver arrives</div>
        </div>
        <button className="promo-small" onClick={onPromo} disabled={promo}><Sparkles size={17} /><span><b>{promo ? "RIDE15 applied" : "First ride with GoRide?"}</b><small>{promo ? "15% off is included in your estimate." : <>Tap to use <strong>RIDE15</strong> for 15% off.</>}</small></span>{promo ? <Check size={16} /> : <ChevronRight size={16} />}</button>
        <div className="demo-note-small"><ShieldCheck size={14} /> Demo experience · No real ride is booked.</div>
      </aside>
    </div>
  </div>;
}

function RideChoices({ rideId, setRideId, fare, distanceKm }: { rideId: string; setRideId: (v: string) => void; fare: number; distanceKm: number }) {
  return <div className="ride-options">{rideTypes.map((ride) => { const selected = ride.id === rideId; const price = (fare / (rideTypes.find((item) => item.id === rideId)?.price ?? 1)) * ride.price; const duration = Math.max(5, Math.round(distanceKm * 1.15) + (ride.id === "xl" ? 3 : ride.id === "premium" ? -2 : 0)); return <button key={ride.id} className={`ride-option ${selected ? "ride-option-selected" : ""} ${ride.id === "comfort" ? "recommended" : ""}`} onClick={() => setRideId(ride.id)}><span className={`ride-car-art car-${ride.image}`}><CarFront size={34} strokeWidth={1.5} /></span><span className="ride-option-info"><b>{ride.short}{ride.id === "comfort" && <span className="reco-tag">POPULAR</span>}</b><small>{ride.capacity} seats · {ride.eta} away</small><span className="ride-description">{ride.detail}</span></span><span className="ride-price"><b>AED {price.toFixed(0)}</b><small>~{duration} min</small></span><span className="ride-radio">{selected && <i />}</span></button>; })}</div>;
}

function ConfirmPage({ pickup, destination, selectedRide, fare, distanceKm, promo, setPromo, promoText, setPromoText, payment, setPayment, methods, matching, announce, onConfirm, onBack }: { methods: PaymentMethod[]; pickup: string; destination: string; selectedRide: typeof rideTypes[number]; fare: number; distanceKm: number; promo: boolean; setPromo: (v: boolean) => void; promoText: string; setPromoText: (v: string) => void; payment: string; setPayment: (v: string) => void; matching: boolean; announce: (v: string, t?: Toast["tone"]) => void; onConfirm: () => void; onBack: () => void }) {
  const baseFare = 12 * selectedRide.price;
  const distanceFare = distanceKm * 2.15 * selectedRide.price;
  const discount = (baseFare + distanceFare) * 0.15;
  return <div className="confirm-page">
    <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> Back to ride options</button>
    <PageHeading eyebrow="BOOK A RIDE · STEP 2 OF 2" title="One last look." copy="Make sure everything feels right before we match you." />
    <div className="confirm-grid">
      <div className="confirm-left">
        <div className="confirm-map"><MapPanel pickup={pickup} destination={destination} compact /><div className="confirm-route-label"><span className="route-start" /><b>{pickup}</b><ChevronRight size={15} /><b>{destination}</b></div></div>
        <div className="panel confirm-ride-panel"><div className={`ride-car-art car-${selectedRide.image}`}><CarFront size={40} strokeWidth={1.5} /></div><div className="confirm-ride-name"><span className="mini-kicker">YOUR RIDE</span><h3>{selectedRide.name}</h3><p>{selectedRide.detail}</p></div><span className="confirm-rating"><Star size={14} fill="currentColor" /> 4.9</span></div>
        <Link to="/safety" className="confirm-safety"><ShieldCheck size={19} /><span><b>Your safety comes first</b><small>Share your trip, see driver details, and get help from the ride screen.</small></span><ChevronRight size={16} /></Link>
      </div>
      <div className="panel fare-panel">
        <h3>Fare breakdown</h3>
        <div className="fare-row"><span>Base fare</span><b>AED {baseFare.toFixed(2)}</b></div>
        <div className="fare-row"><span>Distance · {distanceKm.toFixed(1)} km</span><b>AED {distanceFare.toFixed(2)}</b></div>
        {promo && <div className="fare-row discount-row"><span>RIDE15 promo</span><b>− AED {discount.toFixed(2)}</b></div>}
        <div className="promo-code"><div className="promo-code-input"><Sparkles size={15} /><input placeholder="Add promo code" value={promoText} onChange={(event) => setPromoText(event.target.value)} /></div><button onClick={() => { if (promoText.trim().toUpperCase() === "RIDE15") { setPromo(true); setPromoText("RIDE15"); announce("RIDE15 applied. Your estimate is updated."); } else if (promo) { announce("RIDE15 is already applied."); } else { announce("That code didn't match. Try RIDE15.", "info"); } }}>Apply</button></div>
        <div className="payment-select"><span className="payment-icon"><CreditCard size={17} /></span><span><small>PAYMENT METHOD</small><select value={payment} onChange={(event) => setPayment(event.target.value)} aria-label="Payment method">{methods.map((m) => <option key={m.id}>{methodLabel(m)}</option>)}</select></span><ChevronDown size={15} /></div>
        <div className="fare-total"><span>Total · AED</span><b>{fare.toFixed(2)}</b></div>
        <button className="btn-primary full-btn confirm-btn" disabled={matching} onClick={onConfirm}>{matching ? <><span className="spinner" /> Finding your demo driver…</> : <>Confirm demo ride <ArrowRight size={16} /></>}</button>
        <p className="payment-footnote"><ShieldCheck size={13} /> No payment will be processed. This is a demo.</p>
      </div>
    </div>
  </div>;
}

function TrackingPage({ booking, progress, onFinish, onCancel, onRoute, onChat, onCall, onShare }: { booking: Booking | null; progress: number; onFinish: () => void; onCancel: () => void; onRoute: (mode: "destination" | "stop" | "pickup") => void; onChat: () => void; onCall: () => void; onShare: () => void }) {
  const t = useT();
  if (!booking) return <div className="empty-state panel"><div className="empty-icon"><CarFront size={24} /></div><h2>No active ride</h2><p>Book a ride to see driver matching, live tracking and route changes.</p><Link className="btn-primary" to="/book">Book a ride <ArrowRight size={15} /></Link></div>;
  const toPickup = progress < 0.45;
  const km = booking.distanceKm ?? getRouteDistanceKm(booking.pickup, booking.destination);
  const tripMin = Math.max(5, Math.round(km * 1.25));
  const minsLeft = toPickup ? Math.max(1, Math.round((0.45 - progress) / 0.45 * 6)) : Math.max(1, Math.round((1 - progress) / 0.55 * tripMin));
  const arrival = new Date(Date.now() + minsLeft * 60000);
  const dropOff = new Date(Date.now() + (toPickup ? minsLeft + tripMin : minsLeft) * 60000);
  const time = (d: Date) => d.toLocaleTimeString("en-AE", { hour: "numeric", minute: "2-digit" });
  return <div className="tracking-page"><PageHeading eyebrow="YOUR RIDE · LIVE DEMO" title="Your ride is in motion." copy={toPickup ? "Your driver is on the way to you." : "Sit back. We'll take it from here."} action={<span className="simulation-chip"><span /> SIMULATED TRIP</span>} />
    <div className="tracking-grid">
      <div className="tracking-map"><MapPanel pickup={booking.pickup} destination={booking.destination} stop={booking.stop} tracking progress={progress} /><div className="tracking-map-status"><span className="live-dot" /><b>{toPickup ? "Driver is on the way" : `Heading to ${booking.stop ?? booking.destination}`}</b><small>Simulated location · Not connected to GPS</small></div><div className="eta-bubble"><span>{toPickup ? "ARRIVING IN" : "DROP-OFF IN"}</span><b>{minsLeft} <small>min</small></b></div></div>
      <div className="tracking-side">
        <div className="eta-card"><span className="eta-icon"><Clock3 size={18} /></span><span><small>{toPickup ? "DRIVER ARRIVES" : "ESTIMATED DROP-OFF"}</small><b>{time(toPickup ? arrival : dropOff)}</b><small>About {minsLeft} minute{minsLeft === 1 ? "" : "s"} away</small></span><span className="eta-check"><Check size={16} /></span></div>
        <div className="journey-progress"><div className="progress-labels"><b>{toPickup ? "On the way to pickup" : "On your trip"}</b><span>Step {toPickup ? 2 : 3} of 3</span></div><div className="progress-track"><span style={{ width: `${Math.min(progress * 100, 96)}%` }} /></div><div className="progress-steps"><span className="done"><i><Check size={10} /></i>Matched</span><span className={toPickup ? "current" : "done"}><i />Pickup</span><span className={toPickup ? "" : "current"}><i />Drop-off</span></div></div>
        <div className="panel route-change-card"><div className="section-title"><h2>{t("Change route")}</h2><b className="route-fare">AED {booking.fare.toFixed(2)}</b></div>
          <div className="route-change-grid">
            <button onClick={() => onRoute("destination")}><MapPin size={16} /><span><b>Change destination</b><small>Now: {booking.destination}</small></span></button>
            <button onClick={() => onRoute("stop")}><Plus size={16} /><span><b>{booking.stop ? "Edit stop" : "Add a stop"}</b><small>{booking.stop ? `Now: ${booking.stop}` : "+ AED 5 · one stop"}</small></span></button>
            <button onClick={() => onRoute("pickup")} disabled={!toPickup} title={toPickup ? "" : "You have already been picked up"}><Navigation size={16} /><span><b>Change pickup</b><small>{toPickup ? `Now: ${booking.pickup}` : "Not available after pickup"}</small></span></button>
          </div>
          {booking.changes?.length ? <div className="route-history">{booking.changes.slice(-3).map((c, i) => <small key={i}><RouteIcon size={12} /> {c}</small>)}</div> : null}
        </div>
        <div className="panel driver-card"><div className="driver-card-top"><div className="driver-avatar">RK<span /></div><div className="driver-info"><b>Rashid Khan <span className="verified-mini"><BadgeCheck size={12} /></span></b><span><Star size={13} fill="currentColor" /> 4.96 <i>·</i> 1,284 rides</span></div><div className="car-plate"><b>TESLA</b><small>MODEL 3</small></div></div><div className="vehicle-strip"><span className="vehicle-dot" /><b>White Tesla Model 3</b><span>Dubai · L 48291</span></div><div className="driver-actions"><button onClick={onChat}><span><MessageCircle size={17} /></span>Message</button><button onClick={onShare}><span><Navigation size={17} /></span>Share trip</button><button onClick={onCall}><span><Headphones size={17} /></span>Call</button></div></div>
        <div className="tracking-route panel"><div className="tracking-place"><span className="route-start" /><span><b>{booking.pickup}</b><small>Pickup</small></span><small className="route-time">{time(arrival)}</small></div>{booking.stop && <div className="tracking-place"><span className="route-stop" /><span><b>{booking.stop}</b><small>Stop · driver waits up to 3 min</small></span></div>}<div className="tracking-place"><span className="route-end" /><span><b>{booking.destination}</b><small>Drop-off · {km.toFixed(1)} km</small></span><small className="route-time">{time(dropOff)}</small></div></div>
        <button className="btn-primary full-btn finish-btn" onClick={onFinish}><Check size={16} /> End trip & view receipt</button>
        <button className="cancel-ride" onClick={onCancel}>Cancel ride</button>
      </div>
    </div>
    <div className="tracking-disclaimer"><ShieldCheck size={15} /> This trip is simulated. Driver location, ETA, and vehicle details are fictional and not connected to GPS.</div>
  </div>;
}

function TripsPage({ trips, filter, setFilter, onReceipt, onRebook }: { trips: Booking[]; filter: string; setFilter: (v: string) => void; onReceipt: (trip: Booking) => void; onRebook: (trip: Booking) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const currentMonth = new Intl.DateTimeFormat("en", { month: "short" }).format(new Date());
  const previousMonth = new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const isFirstOfMonth = new Date().getDate() === 1;
  const filtered = useMemo(() => trips.filter((trip) => {
    const matchesStatus = status === "All statuses" || trip.status === status;
    const matchesQuery = `${trip.pickup} ${trip.destination} ${trip.category}`.toLowerCase().includes(query.toLowerCase());
    const matchesDate = filter === "All trips"
      || (filter === "This month" && (trip.date.includes(currentMonth) || /today/i.test(trip.date) || (!isFirstOfMonth && /yesterday/i.test(trip.date))))
      || (filter === "Last month" && (trip.date.includes(previousMonth) || (isFirstOfMonth && /yesterday/i.test(trip.date))));
    return matchesStatus && matchesQuery && matchesDate;
  }), [trips, query, status, filter, currentMonth, previousMonth, isFirstOfMonth]);
  return <div className="trips-page"><PageHeading eyebrow="YOUR JOURNEYS" title="Every ride tells a story." copy="All your trips, thoughtfully kept in one place." action={<button className="btn-primary" onClick={() => {
    const rows = [["Trip", "Date", "Pickup", "Stop", "Destination", "Ride", "Fare (AED)", "Payment", "Status"], ...filtered.map((x) => [x.id, x.date, x.pickup, x.stop ?? "", x.destination, x.category, x.fare.toFixed(2), x.payment ?? "", x.status])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "goride-trips.csv"; a.click(); URL.revokeObjectURL(a.href);
  }}><Download size={15} /> Export trips (CSV)</button>} /><div className="trip-controls"><div className="trip-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trips or locations" /></div><div className="filter-control"><SlidersHorizontal size={15} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option>All statuses</option><option>Completed</option><option>In progress</option><option>Scheduled</option><option>Cancelled</option></select><ChevronDown size={14} /></div><div className="filter-control"><CalendarDays size={15} /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by date"><option>All trips</option><option>This month</option><option>Last month</option></select><ChevronDown size={14} /></div></div><div className="panel trip-table-panel">{filtered.length ? <><div className="trip-table-head"><span>JOURNEY</span><span>DATE & TIME</span><span>RIDE TYPE</span><span>FARE</span><span>STATUS</span><span /></div>{filtered.map((trip) => <div className="trip-row" key={trip.id}><div className="trip-destinations"><span className="trip-route-graphic"><i /><i /></span><span><b>{trip.pickup}</b><small>{trip.stop ? `via ${trip.stop} → ` : ""}{trip.destination}</small></span></div><span className="trip-date">{trip.date}</span><span className="trip-category"><span className={`category-dot ${trip.category.toLowerCase().replace("goride ", "")}`} />{trip.category.replace("GoRide ", "")}</span><b className="trip-fare">AED {trip.fare.toFixed(2)}</b><span className={`status-chip ${trip.status === "Completed" ? "complete-chip" : trip.status === "In progress" ? "progress-chip" : trip.status === "Cancelled" ? "cancelled-chip" : "scheduled-chip"}`}>{trip.status}</span><span className="trip-row-actions">{trip.status === "In progress" ? <Link className="receipt-btn" to="/tracking"><Navigation size={14} /> Track</Link> : trip.status === "Completed" ? <button className="receipt-btn" onClick={() => onReceipt(trip)}><Download size={14} /> Receipt</button> : null}<button className="receipt-btn" onClick={() => onRebook(trip)} title="Book this route again"><RouteIcon size={14} /> Again</button></span></div>)}</> : <div className="empty-inline"><div className="empty-icon"><Search size={19} /></div><b>No rides found</b><span>Try a different search or filter.</span></div>}</div><div className="trip-footnote"><ShieldCheck size={14} /> All rides shown are fictional demo data. Receipts are mock examples.</div></div>;
}

function ScheduledPage({ schedule, pickup, destination, setPickup, setDestination, rideId, setRideId, plannedDateTime, onSubmit, onCancel, onEdit }: { onEdit: (ride: Booking) => void; schedule: Booking[]; pickup: string; destination: string; setPickup: (v: string) => void; setDestination: (v: string) => void; rideId: string; setRideId: (v: string) => void; plannedDateTime: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void; onCancel: (id: string) => void }) {
  const localToday = new Date();
  localToday.setMinutes(localToday.getMinutes() - localToday.getTimezoneOffset());
  const today = localToday.toISOString().slice(0, 10);
  const tomorrow = new Date(localToday.getTime() + 86400000).toISOString().slice(0, 10);
  return <div className="scheduled-page">
    <PageHeading eyebrow="PLAN AHEAD" title="The early bird gets the ride." copy="Schedule a demo ride, and we'll keep it on your radar." />
    <div className="schedule-grid">
      <form className="panel schedule-form" onSubmit={onSubmit}>
        <div className="panel-heading"><span className="panel-icon"><CalendarDays size={18} /></span><div><h3>Plan your next trip</h3><p>Set the details and we'll save your reservation.</p></div></div>
        <LocationFields pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} />
        <div className="schedule-time-grid">
          <label>DATE<input name="scheduledDate" type="date" defaultValue={plannedDateTime ? plannedDateTime.slice(0, 10) : tomorrow} min={today} required /></label>
          <label>PICKUP TIME<input name="scheduledTime" type="time" defaultValue={plannedDateTime ? plannedDateTime.slice(11, 16) : "08:30"} required /></label>
        </div>
        <label className="select-label">PREFERRED RIDE<select value={rideId} onChange={(e) => setRideId(e.target.value)}>{rideTypes.map((ride) => <option value={ride.id} key={ride.id}>{ride.name}</option>)}</select></label>
        <button className="btn-primary full-btn" type="submit"><CalendarDays size={16} /> Schedule demo ride</button>
        <div className="demo-note-small"><ShieldCheck size={14} /> Scheduling is simulated. No driver is reserved.</div>
      </form>
      <div className="schedule-list-wrap">
        <SectionTitle title="Upcoming reservations" action={<span className="count-pill">{schedule.length}</span>} />
        <div className="panel schedule-list">
          {schedule.map((ride) => <div className="scheduled-card" key={ride.id}><div className="schedule-date-box custom-date"><CalendarDays size={17} /></div><div className="scheduled-details"><div className="scheduled-time">{ride.date}</div><b>{ride.pickup} <ArrowRight size={13} /> {ride.stop ? <>{ride.stop} <ArrowRight size={13} /> </> : null}{ride.destination}</b><small>{ride.category} · AED {ride.fare.toFixed(2)}</small></div><div className="scheduled-actions"><button className="icon-btn" onClick={() => onEdit(ride)} aria-label="Edit scheduled ride"><Pencil size={16} /></button><button className="icon-btn" onClick={() => { if (window.confirm(`Cancel ${ride.id}?`)) onCancel(ride.id); }} aria-label="Cancel scheduled ride"><X size={17} /></button></div></div>)}
          {schedule.length === 0 && <div className="schedule-empty"><span className="schedule-empty-icon"><CalendarDays size={20} /></span><b>Your plans, your pace.</b><p>Any demo rides you schedule will appear here.</p></div>}
        </div>
      </div>
    </div>
  </div>;
}

function WalletPage({ balance, promo, setPromo, trips, announce, data, onAdd, onTopUp, onDefault, onRemove }: { balance: number; promo: boolean; setPromo: (v: boolean) => void; trips: Booking[]; announce: (v: string, t?: Toast["tone"]) => void; data: RiderData; onAdd: () => void; onTopUp: () => void; onDefault: (m: PaymentMethod) => void; onRemove: (m: PaymentMethod) => void }) {
  const [code, setCode] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const recentTrips = trips.filter((trip) => trip.status === "Completed").slice(0, 4);
  return <div className="wallet-page">
    <PageHeading eyebrow="PAYMENTS, MADE SIMPLE" title="Your money, your way." copy="A little clarity for every journey." action={<button className="btn-primary" onClick={onTopUp}><Plus size={15} /> Top up wallet</button>} />
    <div className="wallet-page-grid">
      <div className="wallet-page-main">
        <div className="wallet-hero"><div className="wallet-hero-top"><span className="wallet-overline">GORIDE WALLET</span><span className="wallet-active"><span /> ACTIVE</span></div><div className="wallet-amount">AED <b>{balance.toFixed(2)}</b></div><span className="wallet-credit-note">Available balance{data.credits ? ` · + AED ${data.credits} ride credits` : ""}</span><div className="wallet-card-footer"><span>•••• •••• •••• 0814</span><span>GORIDE <Navigation size={14} /></span></div><span className="wallet-decoration one" /><span className="wallet-decoration two" /></div>
        <div className="panel payment-methods">
          <SectionTitle title="Payment methods" action={<button className="add-method" onClick={onAdd}><Plus size={14} /> Add method</button>} />
          {data.methods.map((m) => <div className="payment-method-row" key={m.id}>
            <span className={`method-brand ${m.kind === "card" ? m.brand.toLowerCase() : m.kind}`}>{m.kind === "card" ? m.brand.toUpperCase() : <Wallet size={19} />}</span>
            <span><b>{m.kind === "card" ? `${m.brand} ending in ${m.last4}` : m.brand}{m.nickname ? ` · ${m.nickname}` : ""}</b><small>{m.kind === "card" ? `Expires ${m.expiry} · Demo card` : m.kind === "cash" ? "Pay your driver in cash" : `Balance AED ${balance.toFixed(2)}`}</small></span>
            {m.isDefault && <span className="default-tag">DEFAULT</span>}
            <div className="pop-anchor"><button className="icon-btn" aria-label={`Options for ${methodLabel(m)}`} onClick={() => setMenu(menu === m.id ? null : m.id)}><Ellipsis size={18} /></button>
              {menu === m.id && <div className="pop-menu method-menu" onMouseLeave={() => setMenu(null)}>
                <button disabled={m.isDefault} onClick={() => { onDefault(m); setMenu(null); }}><Check size={14} /> Make default</button>
                {m.kind === "wallet" && <button onClick={() => { onTopUp(); setMenu(null); }}><Plus size={14} /> Top up</button>}
                {m.kind === "card" && <button className="danger" onClick={() => { if (window.confirm(`Remove ${methodLabel(m)}?`)) onRemove(m); setMenu(null); }}><Trash2 size={14} /> Remove card</button>}
              </div>}
            </div>
          </div>)}
        </div>
        <div className="panel transactions">
          <SectionTitle title="Recent transactions" action={<Link className="text-link" to="/wallet/transactions">View all <ArrowRight size={14} /></Link>} />
          {data.topups.slice(0, 1).map((x) => <div className="transaction-row" key={x.id}><span className="transaction-symbol credit"><Wallet size={16} /></span><span><b>Wallet top-up</b><small>{x.date} · {x.method}</small></span><strong className="positive">+ AED {x.amount.toFixed(2)}</strong></div>)}
          {recentTrips.length ? recentTrips.map((trip) => <div className="transaction-row" key={trip.id}><span className="transaction-symbol debit"><CarFront size={17} /></span><span><b>{trip.category}</b><small>{trip.date} · {trip.pickup} → {trip.destination}</small></span><strong>− AED {trip.fare.toFixed(2)}</strong></div>) : <div className="empty-inline"><b>No transactions yet</b><span>Completed ride receipts will appear here.</span></div>}
        </div>
      </div>
      <aside className="wallet-sidebar">
        <div className="promo-wallet-card"><div className="wallet-promo-icon"><Sparkles size={18} /></div><span className="mini-kicker">A LITTLE SOMETHING EXTRA</span><h3>Good rides<br />deserve <em>rewards.</em></h3><p>Apply a code and make your next trip a little sweeter.</p><div className="wallet-code-form"><input placeholder="Enter promo code" value={code} onChange={(e) => setCode(e.target.value)} /><button onClick={() => { if (code.trim().toUpperCase() === "RIDE15" || promo) { setPromo(true); announce("RIDE15 is ready for your next booking."); } else announce("That code didn't match. Try RIDE15.", "info"); }}>Apply</button></div>{promo && <div className="promo-applied"><Check size={14} /> RIDE15 applied · 15% off</div>}</div>
        <div className="wallet-security"><ShieldCheck size={18} /><span><b>Your details stay yours.</b><small>Only a card label (brand and last 4 digits) is saved. No real payment is collected.</small></span></div>
      </aside>
    </div>
  </div>;
}

function DriverPage({ online, setOnline, accepted, setAccepted, earnings: dailyEarnings, completedRides, onComplete, announce }: { online: boolean; setOnline: (v: boolean) => void; accepted: boolean; setAccepted: (v: boolean) => void; earnings: number; completedRides: number; onComplete: () => void; announce: (v: string, t?: Toast["tone"]) => void }) {
  const { user } = useAuth();
  const isDriver = user?.role === "driver";
  const driverName = isDriver ? user.fullName.split(" ")[0] : "Rashid";
  const requests = [
    { from: "Dubai Marina", to: "Downtown Dubai", away: "1.2 km", km: 15.4, min: 22, fare: 46.5, rider: "Amira Malik · 4.9 ★" },
    { from: "JBR", to: "Mall of the Emirates", away: "0.8 km", km: 9.1, min: 15, fare: 33.0, rider: "Omar Saleh · 4.8 ★" },
    { from: "Business Bay", to: "Dubai International Airport", away: "2.1 km", km: 16.8, min: 24, fare: 54.2, rider: "Daniel Okafor · 5.0 ★" },
  ];
  const [reqIndex, setReqIndex] = useState(0);
  const [range, setRange] = useState<"week" | "month">("week");
  const req = requests[reqIndex % requests.length];
  const chartData = range === "week" ? earnings : [{ day: "W1", value: 1890 }, { day: "W2", value: 2210 }, { day: "W3", value: 2050 }, { day: "W4", value: 2470 }];
  const chartTotal = chartData.reduce((a, x) => a + x.value, 0);
  return <div className="driver-page"><PageHeading eyebrow="GORIDE · DRIVER STUDIO" title="Your road, your rules." copy="A clear view of your day, one journey at a time." action={<div className={`online-toggle ${online ? "is-online" : ""}`}><span>{online ? "You're online" : "You're offline"}</span><button onClick={() => { setOnline(!online); announce(!online ? "You're now online in the driver demo." : "You're offline. No new demo requests.", "info"); }} aria-label="Toggle driver availability"><i /></button></div>} /><div className="driver-profile-banner"><div className="driver-profile-avatar">{isDriver ? initials(user.fullName) : "RK"}<span><BadgeCheck size={13} /></span></div><div><div className="driver-verified"><BadgeCheck size={14} /> {isDriver ? `DRIVER · ${user.driver?.status === "approved" ? "VERIFIED" : "VERIFICATION PENDING"}` : "VERIFIED DEMO DRIVER"}</div><h2>Good morning, {driverName}.</h2><p>{isDriver && user.driver ? `${user.driver.vehicle} · ${user.driver.plateNumber}` : "Drive on your terms. We'll take care of the details."}</p>{!user && <Link className="text-link" to="/signup?role=driver">Sign up as a driver <ArrowRight size={14} /></Link>}</div><img className="driver-banner-art" src="/illustrations/drive-with-us.webp" alt="A smiling GoRide driver at the wheel" /></div><div className="driver-stats"><div><span className="driver-stat-icon green"><Wallet size={18} /></span><small>TODAY'S EARNINGS</small><b>AED {dailyEarnings.toFixed(2)}</b><em>↑ 12% from yesterday</em></div><div><span className="driver-stat-icon yellow"><CarFront size={18} /></span><small>COMPLETED RIDES</small><b>{completedRides}</b><em>2 more than your average</em></div><div><span className="driver-stat-icon blue"><Star size={18} /></span><small>PASSENGER RATING</small><b>4.96 <span className="stars-small">★</span></b><em>You're a passenger favourite</em></div></div><div className="driver-content-grid"><div className="panel earnings-panel"><div className="chart-heading"><div><span className="mini-kicker">YOUR MOMENTUM</span><h3>Weekly earnings</h3></div><button className="chart-select" onClick={() => setRange(range === "week" ? "month" : "week")}>{range === "week" ? "This week" : "This month"} <ChevronDown size={14} /></button></div><div className="chart-total">AED {chartTotal.toLocaleString("en-AE", { minimumFractionDigits: 2 })} <span>↑ 8.4%</span></div><div className="earnings-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ left: 0, right: 6, top: 8, bottom: 0 }}><defs><linearGradient id="earningsFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0d9c6a" stopOpacity={0.19} /><stop offset="95%" stopColor="#0d9c6a" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0ee" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9ba6a1", fontSize: 11 }} dy={8} /><Tooltip formatter={(value) => [`AED ${value}`, "Earnings"]} contentStyle={{ borderRadius: 12, border: "1px solid #e8eeea", fontSize: 12 }} /><Area type="monotone" dataKey="value" stroke="#0d9c6a" strokeWidth={2.5} fill="url(#earningsFill)" /></AreaChart></ResponsiveContainer></div></div><div className={`ride-request-card ${!online ? "request-disabled" : ""}`}><div className="request-card-top"><span className="request-type"><span />{accepted ? "ACTIVE DEMO TRIP" : "INCOMING REQUEST"}</span><span className="request-timer">{online && !accepted ? "00:18" : "—"}</span></div><h3>{accepted ? "Passenger picked up" : online ? "A new journey awaits." : "You're off the clock."}</h3><p>{accepted ? `${req.rider} · Demo passenger` : online ? "A nearby passenger could use a lift." : "Go online when you're ready to see demo requests."}</p><div className="request-route"><div><span className="route-start" /><b>{req.from}</b><small>Pickup · {req.away} away</small></div><div><span className="route-end" /><b>{req.to}</b><small>Drop-off</small></div></div><div className="request-details"><span><Navigation size={14} /> {req.km} km total</span><span><Clock3 size={14} /> ~ {req.min} min</span><b>AED {req.fare.toFixed(2)}</b></div>{accepted ? <button className="btn-primary full-btn" onClick={() => { onComplete(); setAccepted(false); setOnline(false); announce(`Demo trip completed. AED ${req.fare.toFixed(2)} added to mock earnings.`); setReqIndex((i) => i + 1); }}>Complete demo trip <Check size={15} /></button> : <div className="request-actions"><button className="btn-quiet" disabled={!online} onClick={() => { setReqIndex((i) => i + 1); announce("Request declined. Showing the next nearby request.", "info"); }}>Decline</button><button className="btn-primary" disabled={!online} onClick={() => { if (!accepted) { setAccepted(true); announce("Demo request accepted. Have a safe ride!"); } }}>Accept request <ArrowRight size={15} /></button></div>}<small className="request-disclaimer">Fictional request · No real passenger is waiting.</small></div></div><div className="driver-note"><ShieldCheck size={15} /> Driver profile, earnings, and ride requests are fictional demo data.</div></div>;
}

function ProfilePage({ announce, darkMode, setDarkMode, data, setNotify, defaultMethod, onPlace, onGo, onLanguage, onLogout }: { darkMode: boolean; setDarkMode: (v: boolean) => void; data: RiderData; setNotify: (v: boolean) => void; defaultMethod?: PaymentMethod; onPlace: (p: SavedPlace | null) => void; onGo: (place: string) => void; onLanguage: () => void; onLogout: () => void; announce: (v: string, t?: Toast["tone"]) => void }) {
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  const completed = data.trips.filter((x) => x.status === "Completed").length;
  const toNext = 5 - (completed % 5);
  return <div className="profile-page"><PageHeading eyebrow="IT'S YOUR GOJOURNEY" title="The details that make it yours." copy="Your account, preferences, and the little things." /><div className="profile-layout"><div className="profile-main">
    <div className="panel identity-card"><div className="identity-avatar">{user ? initials(user.fullName) : "G"}<span><BadgeCheck size={13} /></span></div><div className="identity-copy"><span className="verified-chip"><BadgeCheck size={13} /> {user ? (user.role === "driver" ? "DRIVER ACCOUNT" : "RIDER ACCOUNT") : "GUEST"}</span><h2>{user ? user.fullName : "Guest rider"}</h2><p>{user ? [user.email, user.phone].filter(Boolean).join(" · ") : "Log in to keep your trips, wallet and places on your account."}</p>{user?.driver && <p>{user.driver.vehicle} · {user.driver.plateNumber} · Verification {user.driver.status}</p>}{user ? <p className="muted-line">Member since {new Date(user.createdAt).toLocaleDateString("en-AE", { month: "long", year: "numeric" })} · {completed} completed rides</p> : <Link className="text-link" to="/signup">Create your account <ArrowRight size={14} /></Link>}</div>
      <div className="pop-anchor"><button className="icon-btn" aria-label="More profile options" onClick={() => setMenu(!menu)}><Ellipsis size={20} /></button>{menu && <div className="pop-menu method-menu" onMouseLeave={() => setMenu(false)}>
        {user && <button onClick={() => { document.getElementById("change-password")?.scrollIntoView({ behavior: "smooth" }); setMenu(false); }}><KeyRound size={14} /> Change password</button>}
        <Link to="/support"><Headphones size={14} /> Contact support</Link>
        <Link to="/trips"><Clock3 size={14} /> Trip history</Link>
        {user ? <button className="danger" onClick={onLogout}><ArrowLeft size={14} /> Log out</button> : <Link to="/login"><ArrowRight size={14} /> Log in</Link>}
      </div>}</div>
    </div>
    <div className="panel settings-panel"><SectionTitle title="Your favourite places" action={<button className="add-method" onClick={() => onPlace(null)}><Plus size={14} /> Add place</button>} />
      {data.saved.map((p) => <div className="saved-place" key={p.id}><span className={`saved-icon ${p.icon === "home" ? "home-icon" : "work-icon"}`}>{p.icon === "home" ? <Home size={17} /> : p.icon === "work" ? <Briefcase size={17} /> : <Star size={17} />}</span><button className="saved-place-go" onClick={() => onGo(p.place)} title={`Book a ride to ${p.label}`}><b>{p.label}</b><small>{p.place} · tap to book</small></button><button className="text-link" onClick={() => onPlace(p)}>Edit</button></div>)}
      {!data.saved.length && <div className="empty-inline"><b>No saved places</b><span>Add Home or Work for one-tap booking.</span></div>}
    </div>
    {user && <div id="change-password"><ChangePasswordPanel onDone={(m) => announce(m)} /></div>}
    <div className="panel settings-panel"><SectionTitle title="Preferences" />
      <div className="preference-row"><span className="preference-icon"><Bell size={17} /></span><span><b>Ride notifications</b><small>{data.notifyRides ? "On · ride updates appear under the bell" : "Off · you won't get new ride updates"}</small></span><button className={`toggle ${data.notifyRides ? "toggle-on" : ""}`} onClick={() => setNotify(!data.notifyRides)} aria-label="Toggle notifications"><i /></button></div>
      <div className="preference-row"><span className="preference-icon"><Sparkles size={17} /></span><span><b>Dark mode</b><small>{darkMode ? "On" : "Off"}</small></span><button className={`toggle ${darkMode ? "toggle-on" : ""}`} onClick={() => setDarkMode(!darkMode)} aria-label="Toggle dark mode"><i /></button></div>
      <div className="preference-row"><span className="preference-icon"><CreditCard size={17} /></span><span><b>Preferred payment</b><small>{defaultMethod ? methodLabel(defaultMethod) : "None"}</small></span><Link to="/wallet" className="text-link">Manage</Link></div>
      <div className="preference-row"><span className="preference-icon"><MessageCircle size={17} /></span><span><b>Language</b><small>{data.lang === "ar" ? "العربية (Arabic)" : "English (United Kingdom)"}</small></span><button className="text-link" onClick={onLanguage}>Change</button></div>
    </div>
  </div><aside className="profile-aside"><div className="profile-perks"><div className="perk-spark"><Sparkles size={19} /></div><span className="mini-kicker">YOUR RIDER STATUS</span><h3>GoRide<br /><em>{completed >= 10 ? "gold." : "everyday."}</em></h3><p>Every 5 rides unlock a reward.</p><div className="perk-progress"><span><b>{completed % 5}</b> of 5 rides</span><span>{toNext} to unlock</span><i><b style={{ width: `${((completed % 5) / 5) * 100}%` }} /></i></div></div><div className="profile-links"><Link to="/safety"><ShieldCheck size={17} /> Privacy & safety <ChevronRight size={15} /></Link><Link to="/support"><CircleHelp size={17} /> Help centre <ChevronRight size={15} /></Link>{user ? <button onClick={onLogout}><ArrowLeft size={17} /> Log out <ChevronRight size={15} /></button> : <Link to="/login"><ArrowLeft size={17} /> Log in <ChevronRight size={15} /></Link>}</div><div className="demo-account-note"><ShieldCheck size={15} /> {user ? "Your login is stored securely. Trips, wallet and places are kept on this device for the demo." : "You are browsing as a guest. Log in to see your own profile."}</div></aside></div></div>;
}

function SafetyPage({ onEmergency, onShare }: { onEmergency: () => void; onShare: () => void }) {
  const navigate = useNavigate();
  const features = [
    { icon: Navigation, title: "Share your trip", copy: "Send your live route and ride details to someone you trust.", action: "Share my trip", go: onShare },
    { icon: ShieldCheck, title: "Ride with confidence", copy: "See driver and vehicle details before you meet your ride.", action: "Safety checklist", go: () => document.getElementById("guidelines")?.scrollIntoView({ behavior: "smooth" }) },
    { icon: Headphones, title: "We're here to help", copy: "Our support team is ready to help with your ride questions.", action: "Contact support", go: () => navigate("/support") },
  ];
  return <div className="safety-page"><PageHeading eyebrow="HERE WHEN YOU NEED US" title="You ride. We've got your back." copy="Your safety comes first, every mile of the way." /><div className="safety-hero"><div className="safety-shield"><ShieldCheck size={34} /></div><div><span className="mini-kicker">SAFETY, BUILT INTO EVERY RIDE</span><h2>Help is always<br />within reach.</h2><p>Call UAE emergency services straight from your phone, or share your trip.</p></div><button className="emergency-btn" onClick={onEmergency}><span>!</span> Emergency help</button></div>
    <div className="safety-feature-grid">{features.map(({ icon: Icon, title, copy, action, go }) => <div className="panel safety-feature" key={title}><span className="safety-feature-icon"><Icon size={19} /></span><h3>{title}</h3><p>{copy}</p><button className="text-link" onClick={go}>{action} <ArrowRight size={14} /></button></div>)}</div>
    <div className="safety-bottom-grid"><div className="panel safety-guidelines" id="guidelines"><SectionTitle title="A few good-to-knows" /><div className="guideline"><span>01</span><div><b>Check your ride</b><p>Match the vehicle and plate with the details in your app.</p></div><Check size={16} /></div><div className="guideline"><span>02</span><div><b>Share the journey</b><p>Let a friend or family member know you're on your way.</p></div><Check size={16} /></div><div className="guideline"><span>03</span><div><b>Trust your instincts</b><p>If something doesn't feel right, end the trip and reach out.</p></div><Check size={16} /></div></div><div className="panel faq-panel"><SectionTitle title="Questions, answered" /><details><summary>Is this connected to real drivers? <ChevronDown size={15} /></summary><p>No. GoRide is a demonstration prototype. All driver profiles and trips are fictional.</p></details><details><summary>Can I change my destination during a ride? <ChevronDown size={15} /></summary><p>Yes. Open your live ride and use Change route to change the destination, add a stop, or move the pickup before the driver arrives.</p></details><details><summary>How can I report a lost item? <ChevronDown size={15} /></summary><p>Go to Support, choose "Lost item" and pick the trip. You can follow the reply there.</p></details><Link className="text-link" to="/support">More help topics <ArrowRight size={14} /></Link></div></div>
    <div className="safety-disclaimer"><ShieldCheck size={14} /> Emergency buttons open your phone dialler for 999 / 998. GoRide does not contact anyone on your behalf in this demo.</div></div>;
}

export default App;
