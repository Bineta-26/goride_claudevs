import { lazy, Suspense, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownUp, ArrowLeft, ArrowRight, BadgeCheck, Bell, CalendarDays, CarFront, Check, ChevronDown, ChevronRight,
  CircleHelp, Clock3, CreditCard, Download, Ellipsis, Headphones, Heart, Home, Leaf, MapPin, Menu, MessageCircle,
  Navigation, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, Wallet, X, Zap,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import MapPanel from "./MapPanel";
import { AuthPage, ChangePasswordPanel, initials, useAuth } from "./Auth";

const AdminPortal = lazy(() => import("./Admin"));
import { estimateFare, getRouteDistanceKm, places, rideTypes, seedTrips, type Booking } from "./data";

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

function loadStored<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch (error) {
    console.warn(`Could not load GoRide demo data for "${key}".`, error);
    return fallback;
  }
}

function Logo({ small = false }: { small?: boolean }) {
  return <Link to="/dashboard" className={`brand ${small ? "brand-small" : ""}`} aria-label="GoRide home"><span className="brand-mark"><Navigation size={19} fill="currentColor" /></span><span>GoRide</span><sup>®</sup></Link>;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
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
  const [payment, setPayment] = useState("Visa ···· 4242");
  const [booking, setBooking] = useState<Booking | null>(() => loadStored("goride-active", null));
  const [trips, setTrips] = useState<Booking[]>(() => loadStored("goride-trips", seedTrips));
  const [schedule, setSchedule] = useState<Booking[]>(() => loadStored("goride-schedule", []));
  const [walletBalance, setWalletBalance] = useState(() => loadStored("goride-wallet", 245.5));
  const [filter, setFilter] = useState("All trips");
  const [darkMode, setDarkMode] = useState(() => loadStored("goride-dark", false));
  const [driverOnline, setDriverOnline] = useState(false);
  const [requestAccepted, setRequestAccepted] = useState(false);
  const [driverEarnings, setDriverEarnings] = useState(486.5);
  const [driverCompletedRides, setDriverCompletedRides] = useState(12);
  const [trackingProgress, setTrackingProgress] = useState(0.35);
  const [matching, setMatching] = useState(false);

  useEffect(() => localStorage.setItem("goride-trips", JSON.stringify(trips)), [trips]);
  useEffect(() => localStorage.setItem("goride-schedule", JSON.stringify(schedule)), [schedule]);
  useEffect(() => localStorage.setItem("goride-active", JSON.stringify(booking)), [booking]);
  useEffect(() => localStorage.setItem("goride-wallet", JSON.stringify(walletBalance)), [walletBalance]);
  useEffect(() => localStorage.setItem("goride-dark", JSON.stringify(darkMode)), [darkMode]);
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
  const currentTitle = navItems.find((item) => location.pathname.startsWith(item.path))?.label ??
    (location.pathname === "/driver" ? "Driver mode" : location.pathname === "/confirm" ? "Confirm your ride" : location.pathname === "/tracking" ? "On your way" : location.pathname === "/profile" ? "Profile & settings" : location.pathname === "/safety" ? "Safety & support" : location.pathname === "/signup" ? "Create account" : location.pathname === "/login" ? "Log in" : "Your ride, your way");

  const makeBooking = (status: Booking["status"], id = `GR-${Math.floor(2000 + Math.random() * 7000)}`): Booking => ({
    id, pickup, destination, category: selectedRide.name, fare, payment, date: `Today, ${new Date().toLocaleTimeString("en-AE", { hour: "numeric", minute: "2-digit" })}`, status,
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
      navigate("/tracking");
    }, 1400);
  };
  const finishRide = () => {
    if (!booking) return;
    setTrips((current) => current.map((trip) => trip.id === booking.id ? { ...trip, status: "Completed" } : trip));
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
  };
  const navToBook = () => navigate("/book");
  const swapLocations = () => { setPickup(destination); setDestination(pickup); };

  if (location.pathname.startsWith("/admin/")) {
    return <Suspense fallback={null}><Routes><Route path="/admin/:key" element={<AdminPortal />} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></Suspense>;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top"><Logo /><button className="icon-btn sidebar-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
        <div className="demo-pill"><span /> DEMO PROTOTYPE</div>
        <div className="sidebar-label">MENU</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ path, label, icon: Icon }) => <Link key={path} to={path} onClick={() => setMenuOpen(false)} className={`nav-link ${location.pathname === path ? "active" : ""}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === "Book a ride" && <span className="nav-shortcut">⌘ B</span>}</Link>)}
        </nav>
        <div className="sidebar-label more-label">MORE</div>
        <nav className="side-nav">
          <Link to="/driver" onClick={() => setMenuOpen(false)} className={`nav-link ${location.pathname === "/driver" ? "active" : ""}`}><CarFront size={18} /><span>Driver mode</span><span className="driver-tag">NEW</span></Link>
          <Link to="/safety" onClick={() => setMenuOpen(false)} className={`nav-link ${location.pathname === "/safety" ? "active" : ""}`}><ShieldCheck size={18} /><span>Safety & support</span></Link>
          <Link to="/profile" onClick={() => setMenuOpen(false)} className={`nav-link ${location.pathname === "/profile" ? "active" : ""}`}><Ellipsis size={18} /><span>More</span></Link>
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-promo"><div className="promo-icon"><Sparkles size={18} /></div><strong>Good things<br />come with rides.</strong><p>Enjoy 15% off your next trip.</p><button onClick={() => { setPromo(true); setPromoText("RIDE15"); announce("RIDE15 applied to your next booking."); }}>Apply RIDE15 <ArrowRight size={14} /></button></div>
        {user ? <button className="profile-mini" onClick={() => navigate("/profile")}><div className="avatar">{userInitials}</div><span className="profile-mini-copy"><b>{user.fullName}</b><small>{user.role === "driver" ? "Driver account" : "Rider account"}</small></span><ChevronDown size={16} /></button> : <div className="sidebar-auth"><Link className="btn-primary" to="/signup" onClick={() => setMenuOpen(false)}>Create account</Link><Link className="sidebar-login" to="/login" onClick={() => setMenuOpen(false)}>Log in</Link></div>}
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn mobile-menu" aria-label="Open menu" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumbs"><span>GoRide</span><ChevronRight size={14} /><b>{currentTitle}</b></div>
          <div className="topbar-actions"><div className="city-chip"><span className="live-dot" /> Dubai, UAE <ChevronDown size={14} /></div><button className="icon-btn notification-btn" aria-label="Notifications" onClick={() => announce("You're all caught up. No new notifications.", "info")}><Bell size={18} /><i /></button>{user ? <button className="top-avatar" aria-label="Open profile" onClick={() => navigate("/profile")}>{userInitials}</button> : <Link className="top-login" to="/login">Log in</Link>}</div>
        </header>
        <div className="page-content">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.22 }}>
              <Routes>
                <Route path="/" element={<LandingPage pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} goBook={navToBook} goDriver={() => navigate(user?.role === "driver" ? "/driver" : "/signup?role=driver")} />} />
                <Route path="/dashboard" element={<Dashboard goBook={navToBook} pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} announce={announce} fare={fare} balance={walletBalance} schedule={schedule} />} />
                <Route path="/book" element={<BookingPage pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} swap={swapLocations} rideId={rideId} setRideId={setRideId} fare={fare} distanceKm={distanceKm} laterDateTime={laterDateTime} setLaterDateTime={setLaterDateTime} onContinue={(when, plannedTime) => {
                  if (when === "Later") {
                    if (new Date(plannedTime).getTime() <= Date.now()) { announce("Choose a pickup time in the future.", "info"); return; }
                    setScheduledPickUp(plannedTime);
                    navigate("/scheduled");
                  } else {
                    navigate("/confirm");
                  }
                }} />} />
                <Route path="/confirm" element={<ConfirmPage pickup={pickup} destination={destination} selectedRide={selectedRide} fare={fare} distanceKm={distanceKm} promo={promo} setPromo={setPromo} promoText={promoText} setPromoText={setPromoText} payment={payment} setPayment={setPayment} matching={matching} announce={announce} onConfirm={startMatching} onBack={() => navigate("/book")} />} />
                <Route path="/tracking" element={<TrackingPage booking={booking} progress={trackingProgress} onFinish={finishRide} announce={announce} onCancel={cancelRide} />} />
                <Route path="/trips" element={<TripsPage trips={trips} filter={filter} setFilter={setFilter} announce={announce} />} />
                <Route path="/scheduled" element={<ScheduledPage schedule={schedule} pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} rideId={rideId} setRideId={setRideId} plannedDateTime={scheduledPickUp} onSubmit={scheduleRide} onCancel={(id) => { setSchedule((items) => items.filter((trip) => trip.id !== id)); announce("Scheduled demo ride cancelled.", "info"); }} />} />
                <Route path="/wallet" element={<WalletPage balance={walletBalance} promo={promo} setPromo={setPromo} trips={trips} announce={announce} />} />
                <Route path="/driver" element={<DriverPage online={driverOnline} setOnline={setDriverOnline} accepted={requestAccepted} setAccepted={setRequestAccepted} earnings={driverEarnings} completedRides={driverCompletedRides} onComplete={() => { setDriverEarnings((value) => Math.round((value + 46.5) * 100) / 100); setDriverCompletedRides((value) => value + 1); }} announce={announce} />} />
                <Route path="/profile" element={<ProfilePage darkMode={darkMode} setDarkMode={setDarkMode} announce={announce} onLogout={async () => { await logout(); announce("You have been logged out.", "info"); navigate("/"); }} />} />
                <Route path="/safety" element={<SafetyPage announce={announce} />} />
                <Route path="/signup" element={<AuthPage mode="signup" />} />
                <Route path="/login" element={<AuthPage mode="login" />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.slice(0, 4).map(({ path, label, icon: Icon }) => <Link key={path} to={path} className={location.pathname === path ? "active" : ""}><Icon size={19} /><span>{label === "Overview" ? "Home" : label.split(" ")[0]}</span></Link>)}</nav>
      </main>
      <AnimatePresence>{toast && <motion.div className={`toast ${toast.tone ?? ""}`} initial={{ opacity: 0, y: 14, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }}><span className="toast-check"><Check size={15} /></span>{toast.text}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></motion.div>}</AnimatePresence>
      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
    </div>
  );
}

function LandingAuthLinks() {
  const { user } = useAuth();
  if (user) return <Link to={user.role === "driver" ? "/driver" : "/dashboard"} className="landing-signin">Hi, {user.fullName.split(" ")[0]} <ArrowRight size={14} /></Link>;
  return <div className="landing-auth"><Link to="/login" className="landing-login">Log in</Link><Link to="/signup" className="landing-signin">Sign up <ArrowRight size={14} /></Link></div>;
}

function PageHeading({ eyebrow, title, copy, action }: { eyebrow?: string; title: string; copy?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{copy && <p>{copy}</p>}</div>{action}</div>;
}
function SectionTitle({ title, action }: { title: string; action?: ReactNode }) { return <div className="section-title"><h2>{title}</h2>{action}</div>; }

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

function Dashboard({ goBook, pickup, destination, setPickup, setDestination, announce, fare, balance, schedule }: { goBook: () => void; pickup: string; destination: string; setPickup: (v: string) => void; setDestination: (v: string) => void; announce: (v: string, t?: Toast["tone"]) => void; fare: number; balance: number; schedule: Booking[] }) {
  return <div className="dashboard-page">
    <div className="welcome-row"><div><div className="eyebrow">{new Date().toLocaleDateString("en-AE", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()} <span className="eyebrow-dot" /> YOUR CITY, YOUR CALL</div><h1>Good morning, Amira <span className="wave">✦</span></h1><p>Where will the day take you?</p></div><button className="round-weather" aria-label="Current conditions"><span>☀</span><b>29°</b><small>Sunny in Dubai</small></button></div>
    <div className="dashboard-grid">
      <section className="map-booking-card"><MapPanel pickup={pickup} destination={destination} /><div className="map-booking-panel"><div className="map-panel-heading"><span className="mini-kicker">LET'S GET MOVING</span><span className="secure-label"><ShieldCheck size={13} /> Safe by design</span></div><h2>Where to, Amira?</h2><LocationFields pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} /><button className="btn-primary full-btn" onClick={goBook}>Find a ride <ArrowRight size={17} /></button><div className="fare-estimate"><span>Estimated fare from</span><b>AED {fare.toFixed(0)}</b></div></div></section>
      <div className="dashboard-aside">
        <div className="wallet-card"><div className="wallet-card-top"><span className="wallet-icon"><Wallet size={19} /></span><button aria-label="Wallet options" className="icon-btn light-icon" onClick={() => announce("Wallet options opened in Payments.", "info")}><Ellipsis size={20} /></button></div><span className="wallet-overline">YOUR WALLET</span><strong>AED {balance.toFixed(2)}</strong><div className="wallet-bottom"><span>+ AED 25.00 in ride credits</span><Link to="/wallet">Manage <ArrowRight size={13} /></Link></div><div className="wallet-glow" /></div>
        <NextRideCard schedule={schedule} />
        <div className="support-mini"><span className="support-icon"><Headphones size={18} /></span><div><b>We're here for you</b><small>Get help anytime, anywhere.</small></div><Link to="/safety" aria-label="Go to support"><ArrowRight size={17} /></Link></div>
      </div>
    </div>
    <div className="stats-strip"><div><span className="stat-icon mint"><Navigation size={16} /></span><span><b>12</b><small>Rides this month</small></span><span className="stat-up">↑ 20%</span></div><div><span className="stat-icon peach"><Heart size={16} /></span><span><b>4.9</b><small>Your rider rating</small></span><span className="stat-stars">★★★★★</span></div><div><span className="stat-icon violet"><Zap size={16} /></span><span><b>3</b><small>Rewards unlocked</small></span><Link to="/wallet" className="stat-link">View rewards <ArrowRight size={13} /></Link></div></div>
    <div className="dashboard-bottom"><section className="recent-section"><SectionTitle title="Recent destinations" action={<Link className="text-link" to="/trips">See all <ArrowRight size={14} /></Link>} /><div className="destination-list">{[{ name: "Dubai Mall", detail: "Downtown Dubai", icon: "bag" }, { name: "One Life Kitchen", detail: "Business Bay", icon: "food" }, { name: "JBR Beach", detail: "Jumeirah Beach Residence", icon: "beach" }].map((item) => <button className="destination-row" key={item.name} onClick={() => { setDestination(item.name === "Dubai Mall" ? "Downtown Dubai" : item.name === "JBR Beach" ? "JBR" : "Business Bay"); goBook(); }}><span className={`destination-symbol ${item.icon}`}>{item.icon === "beach" ? "◒" : item.icon === "food" ? "✳" : "⌂"}</span><span><b>{item.name}</b><small>{item.detail}</small></span><span className="destination-distance">~ 18 min</span><ChevronRight size={16} /></button>)}</div></section><section className="promo-card"><div className="promo-card-content"><div className="promo-badge"><Sparkles size={14} /> A LITTLE THANK YOU</div><h3>Your next trip<br />is on <em>us.</em></h3><p>Use your ride credits to make your next journey even sweeter.</p><button className="btn-dark" onClick={() => { announce("Your AED 25 demo ride credit is ready to use.", "info"); goBook(); }}>Use my credits <ArrowRight size={15} /></button></div><div className="promo-art"><span className="promo-sun" /><span className="promo-road" /><span className="promo-car"><CarFront size={31} /></span><span className="promo-art-spark">✦</span></div></section></div>
    <div className="prototype-note"><ShieldCheck size={14} /> GoRide is a demo prototype. Drivers, fares, and trip activity are simulated.</div>
  </div>;
}

function BookingPage({ pickup, destination, setPickup, setDestination, swap, rideId, setRideId, fare, distanceKm, laterDateTime, setLaterDateTime, onContinue }: { pickup: string; destination: string; setPickup: (v: string) => void; setDestination: (v: string) => void; swap: () => void; rideId: string; setRideId: (v: string) => void; fare: number; distanceKm: number; laterDateTime: string; setLaterDateTime: (v: string) => void; onContinue: (when: string, plannedTime: string) => void }) {
  const [when, setWhen] = useState("Now");
  return <div className="booking-page">
    <PageHeading eyebrow="BOOK A RIDE · STEP 1 OF 2" title="Let's get you there." copy="Every great journey starts with a destination." action={<div className="booking-steps"><span className="step-active">01</span><i /><span>02</span></div>} />
    <div className="booking-layout">
      <div className="booking-main">
        <section className="panel location-panel"><div className="panel-heading"><span className="panel-icon"><MapPin size={18} /></span><div><h3>Your route</h3><p>Choose your pickup and drop-off points</p></div><span className="verified-chip"><BadgeCheck size={14} /> Smart suggestions</span></div><LocationFields pickup={pickup} destination={destination} setPickup={setPickup} setDestination={setDestination} swap={swap} /><div className="route-summary"><span><Navigation size={15} /> {distanceKm.toFixed(1)} km</span><span><Clock3 size={15} /> About {Math.max(5, Math.round(distanceKm * 1.25))} min</span><span className="route-traffic"><span /> Typical conditions · demo estimate</span></div></section>
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
        <div className="promo-small"><Sparkles size={17} /><span><b>First ride with GoRide?</b><small>Use <strong>RIDE15</strong> for 15% off.</small></span><ChevronRight size={16} /></div>
        <div className="demo-note-small"><ShieldCheck size={14} /> Demo experience · No real ride is booked.</div>
      </aside>
    </div>
  </div>;
}

function RideChoices({ rideId, setRideId, fare, distanceKm }: { rideId: string; setRideId: (v: string) => void; fare: number; distanceKm: number }) {
  return <div className="ride-options">{rideTypes.map((ride) => { const selected = ride.id === rideId; const price = (fare / (rideTypes.find((item) => item.id === rideId)?.price ?? 1)) * ride.price; const duration = Math.max(5, Math.round(distanceKm * 1.15) + (ride.id === "xl" ? 3 : ride.id === "premium" ? -2 : 0)); return <button key={ride.id} className={`ride-option ${selected ? "ride-option-selected" : ""} ${ride.id === "comfort" ? "recommended" : ""}`} onClick={() => setRideId(ride.id)}><span className={`ride-car-art car-${ride.image}`}><CarFront size={34} strokeWidth={1.5} /></span><span className="ride-option-info"><b>{ride.short}{ride.id === "comfort" && <span className="reco-tag">POPULAR</span>}</b><small>{ride.capacity} seats · {ride.eta} away</small><span className="ride-description">{ride.detail}</span></span><span className="ride-price"><b>AED {price.toFixed(0)}</b><small>~{duration} min</small></span><span className="ride-radio">{selected && <i />}</span></button>; })}</div>;
}

function ConfirmPage({ pickup, destination, selectedRide, fare, distanceKm, promo, setPromo, promoText, setPromoText, payment, setPayment, matching, announce, onConfirm, onBack }: { pickup: string; destination: string; selectedRide: typeof rideTypes[number]; fare: number; distanceKm: number; promo: boolean; setPromo: (v: boolean) => void; promoText: string; setPromoText: (v: string) => void; payment: string; setPayment: (v: string) => void; matching: boolean; announce: (v: string, t?: Toast["tone"]) => void; onConfirm: () => void; onBack: () => void }) {
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
        <div className="confirm-safety"><ShieldCheck size={19} /><span><b>Your safety comes first</b><small>Your demo ride includes simulated trip sharing and driver details.</small></span><ChevronRight size={16} /></div>
      </div>
      <div className="panel fare-panel">
        <h3>Fare breakdown</h3>
        <div className="fare-row"><span>Base fare</span><b>AED {baseFare.toFixed(2)}</b></div>
        <div className="fare-row"><span>Distance · {distanceKm.toFixed(1)} km</span><b>AED {distanceFare.toFixed(2)}</b></div>
        {promo && <div className="fare-row discount-row"><span>RIDE15 promo</span><b>− AED {discount.toFixed(2)}</b></div>}
        <div className="promo-code"><div className="promo-code-input"><Sparkles size={15} /><input placeholder="Add promo code" value={promoText} onChange={(event) => setPromoText(event.target.value)} /></div><button onClick={() => { if (promoText.trim().toUpperCase() === "RIDE15") { setPromo(true); setPromoText("RIDE15"); announce("RIDE15 applied. Your estimate is updated."); } else if (promo) { announce("RIDE15 is already applied."); } else { announce("That code didn't match. Try RIDE15.", "info"); } }}>Apply</button></div>
        <div className="payment-select"><span className="payment-icon"><CreditCard size={17} /></span><span><small>PAYMENT METHOD</small><select value={payment} onChange={(event) => setPayment(event.target.value)} aria-label="Payment method"><option>Visa ···· 4242</option><option>Cash</option><option>GoRide Wallet</option></select></span><ChevronDown size={15} /></div>
        <div className="fare-total"><span>Total · AED</span><b>{fare.toFixed(2)}</b></div>
        <button className="btn-primary full-btn confirm-btn" disabled={matching} onClick={onConfirm}>{matching ? <><span className="spinner" /> Finding your demo driver…</> : <>Confirm demo ride <ArrowRight size={16} /></>}</button>
        <p className="payment-footnote"><ShieldCheck size={13} /> No payment will be processed. This is a demo.</p>
      </div>
    </div>
  </div>;
}

function TrackingPage({ booking, progress, onFinish, announce, onCancel }: { booking: Booking | null; progress: number; onFinish: () => void; announce: (v: string, t?: Toast["tone"]) => void; onCancel: () => void }) {
  if (!booking) return <div className="empty-state panel"><div className="empty-icon"><CarFront size={24} /></div><h2>No active demo ride</h2><p>Book a ride to see simulated driver matching and trip tracking.</p><Link className="btn-primary" to="/book">Book a ride <ArrowRight size={15} /></Link></div>;
  return <div className="tracking-page"><PageHeading eyebrow="YOUR RIDE · LIVE DEMO" title="Your ride is in motion." copy="Sit back. We'll take it from here." action={<span className="simulation-chip"><span /> SIMULATED TRIP</span>} /><div className="tracking-grid"><div className="tracking-map"><MapPanel pickup={booking.pickup} destination={booking.destination} tracking progress={progress} /><div className="tracking-map-status"><span className="live-dot" /><b>Driver is on the way</b><small>Simulated location · Not connected to GPS</small></div><div className="eta-bubble"><span>ARRIVING IN</span><b>4 <small>min</small></b></div></div><div className="tracking-side"><div className="eta-card"><span className="eta-icon"><Clock3 size={18} /></span><span><small>ESTIMATED ARRIVAL</small><b>8:42 <em>AM</em></b><small>About 4 minutes away</small></span><span className="eta-check"><Check size={16} /></span></div><div className="journey-progress"><div className="progress-labels"><b>On the way to pickup</b><span>Step 2 of 3</span></div><div className="progress-track"><span style={{ width: `${Math.min(progress * 100, 86)}%` }} /></div><div className="progress-steps"><span className="done"><i><Check size={10} /></i>Matched</span><span className="current"><i />Pickup</span><span><i />Drop-off</span></div></div><div className="panel driver-card"><div className="driver-card-top"><div className="driver-avatar">RK<span /></div><div className="driver-info"><b>Rashid Khan <span className="verified-mini"><BadgeCheck size={12} /></span></b><span><Star size={13} fill="currentColor" /> 4.96 <i>·</i> 1,284 rides</span></div><div className="car-plate"><b>TESLA</b><small>MODEL 3</small></div></div><div className="vehicle-strip"><span className="vehicle-dot" /><b>White Tesla Model 3</b><span>Dubai · L 48291</span></div><div className="driver-actions"><button onClick={() => announce("Calling Rashid is simulated in this prototype.", "info")}><span><MessageCircle size={17} /></span>Message</button><button onClick={() => announce("Trip sharing link copied (demo).")}><span><Navigation size={17} /></span>Share trip</button><button onClick={() => announce("Calling your driver is simulated in this prototype.", "info")}><span><Headphones size={17} /></span>Call</button></div></div><div className="tracking-route panel"><div className="tracking-place"><span className="route-start" /><span><b>{booking.pickup}</b><small>Pickup · Near you</small></span><small className="route-time">8:42 AM</small></div><div className="tracking-place"><span className="route-end" /><span><b>{booking.destination}</b><small>Drop-off · 14.2 km</small></span><small className="route-time">9:00 AM</small></div></div><button className="btn-primary full-btn finish-btn" onClick={onFinish}><Check size={16} /> End demo trip & view receipt</button><button className="cancel-ride" onClick={onCancel}>Cancel demo ride</button></div></div><div className="tracking-disclaimer"><ShieldCheck size={15} /> This trip is simulated. Driver location, ETA, and vehicle details are fictional and not connected to GPS.</div></div>;
}

function TripsPage({ trips, filter, setFilter, announce }: { trips: Booking[]; filter: string; setFilter: (v: string) => void; announce: (v: string, t?: Toast["tone"]) => void }) {
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
  return <div className="trips-page"><PageHeading eyebrow="YOUR JOURNEYS" title="Every ride tells a story." copy="All your trips, thoughtfully kept in one place." action={<button className="btn-primary" onClick={() => window.print()}><Download size={15} /> Export trips</button>} /><div className="trip-controls"><div className="trip-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trips or locations" /></div><div className="filter-control"><SlidersHorizontal size={15} /><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter by status"><option>All statuses</option><option>Completed</option><option>In progress</option><option>Scheduled</option><option>Cancelled</option></select><ChevronDown size={14} /></div><div className="filter-control"><CalendarDays size={15} /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter by date"><option>All trips</option><option>This month</option><option>Last month</option></select><ChevronDown size={14} /></div></div><div className="panel trip-table-panel">{filtered.length ? <><div className="trip-table-head"><span>JOURNEY</span><span>DATE & TIME</span><span>RIDE TYPE</span><span>FARE</span><span>STATUS</span><span /></div>{filtered.map((trip) => <div className="trip-row" key={trip.id}><div className="trip-destinations"><span className="trip-route-graphic"><i /><i /></span><span><b>{trip.pickup}</b><small>{trip.destination}</small></span></div><span className="trip-date">{trip.date}</span><span className="trip-category"><span className={`category-dot ${trip.category.toLowerCase().replace("goride ", "")}`} />{trip.category.replace("GoRide ", "")}</span><b className="trip-fare">AED {trip.fare.toFixed(2)}</b><span className={`status-chip ${trip.status === "Completed" ? "complete-chip" : trip.status === "In progress" ? "progress-chip" : "scheduled-chip"}`}>{trip.status}</span><button className="receipt-btn" onClick={() => announce(`Receipt ${trip.id} downloaded (demo).`)}><Download size={14} /> Receipt</button></div>)}</> : <div className="empty-inline"><div className="empty-icon"><Search size={19} /></div><b>No rides found</b><span>Try a different search or filter.</span></div>}</div><div className="trip-footnote"><ShieldCheck size={14} /> All rides shown are fictional demo data. Receipts are mock examples.</div></div>;
}

function ScheduledPage({ schedule, pickup, destination, setPickup, setDestination, rideId, setRideId, plannedDateTime, onSubmit, onCancel }: { schedule: Booking[]; pickup: string; destination: string; setPickup: (v: string) => void; setDestination: (v: string) => void; rideId: string; setRideId: (v: string) => void; plannedDateTime: string; onSubmit: (e: FormEvent<HTMLFormElement>) => void; onCancel: (id: string) => void }) {
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
          {schedule.map((ride) => <div className="scheduled-card" key={ride.id}><div className="schedule-date-box custom-date"><CalendarDays size={17} /></div><div className="scheduled-details"><div className="scheduled-time">{ride.date}</div><b>{ride.pickup} <ArrowRight size={13} /> {ride.destination}</b><small>{ride.category} · Demo reservation</small></div><button className="icon-btn" onClick={() => onCancel(ride.id)} aria-label="Cancel scheduled ride"><X size={17} /></button></div>)}
          {schedule.length === 0 && <div className="schedule-empty"><span className="schedule-empty-icon"><CalendarDays size={20} /></span><b>Your plans, your pace.</b><p>Any demo rides you schedule will appear here.</p></div>}
        </div>
      </div>
    </div>
  </div>;
}

function WalletPage({ balance, promo, setPromo, trips, announce }: { balance: number; promo: boolean; setPromo: (v: boolean) => void; trips: Booking[]; announce: (v: string, t?: Toast["tone"]) => void }) {
  const [code, setCode] = useState("");
  const recentTrips = trips.filter((trip) => trip.status === "Completed").slice(0, 4);
  return <div className="wallet-page">
    <PageHeading eyebrow="PAYMENTS, MADE SIMPLE" title="Your money, your way." copy="A little clarity for every journey." />
    <div className="wallet-page-grid">
      <div className="wallet-page-main">
        <div className="wallet-hero"><div className="wallet-hero-top"><span className="wallet-overline">GORIDE WALLET</span><span className="wallet-active"><span /> ACTIVE</span></div><div className="wallet-amount">AED <b>{balance.toFixed(2)}</b></div><span className="wallet-credit-note">Available balance · Mock wallet only</span><div className="wallet-card-footer"><span>•••• •••• •••• 0814</span><span>GORIDE <Navigation size={14} /></span></div><span className="wallet-decoration one" /><span className="wallet-decoration two" /></div>
        <div className="panel payment-methods">
          <SectionTitle title="Payment methods" action={<button className="add-method" onClick={() => announce("Payment methods are mock demos only. No actual card data is collected.", "info")}><Plus size={14} /> Add method</button>} />
          <div className="payment-method-row"><span className="method-brand visa">VISA</span><span><b>Visa ending in 4242</b><small>Expires 08/28 · Mock card</small></span><span className="default-tag">DEFAULT</span><button className="icon-btn" aria-label="Payment options" onClick={() => announce("This is a fictional payment method.", "info")}><Ellipsis size={18} /></button></div>
          <div className="payment-method-row"><span className="method-brand cash"><Wallet size={19} /></span><span><b>Cash</b><small>Pay your driver in cash (demo)</small></span><button className="icon-btn" aria-label="Set cash payment" onClick={() => announce("Cash selected for your next demo ride.")}><ChevronRight size={17} /></button></div>
        </div>
        <div className="panel transactions">
          <SectionTitle title="Recent transactions" action={<button className="text-link" onClick={() => announce("Showing all demo transactions.", "info")}>View all <ArrowRight size={14} /></button>} />
          {recentTrips.length ? recentTrips.map((trip) => <div className="transaction-row" key={trip.id}><span className="transaction-symbol debit"><CarFront size={17} /></span><span><b>{trip.category}</b><small>{trip.date} · {trip.pickup} → {trip.destination}</small></span><strong>− AED {trip.fare.toFixed(2)}</strong></div>) : <div className="empty-inline"><b>No demo transactions yet</b><span>Completed ride receipts will appear here.</span></div>}
          <div className="transaction-row"><span className="transaction-symbol credit"><Sparkles size={16} /></span><span><b>Ride credit</b><small>Welcome reward · Demo credit</small></span><strong className="positive">+ AED 25.00</strong></div>
        </div>
      </div>
      <aside className="wallet-sidebar">
        <div className="promo-wallet-card"><div className="wallet-promo-icon"><Sparkles size={18} /></div><span className="mini-kicker">A LITTLE SOMETHING EXTRA</span><h3>Good rides<br />deserve <em>rewards.</em></h3><p>Apply a code and make your next trip a little sweeter.</p><div className="wallet-code-form"><input placeholder="Enter promo code" value={code} onChange={(e) => setCode(e.target.value)} /><button onClick={() => { if (code.toUpperCase() === "RIDE15" || promo) { setPromo(true); announce("RIDE15 is ready for your next booking."); } else announce("That code didn't match. Try RIDE15.", "info"); }}>Apply</button></div>{promo && <div className="promo-applied"><Check size={14} /> RIDE15 applied · 15% off</div>}</div>
        <div className="wallet-security"><ShieldCheck size={18} /><span><b>Your details stay yours.</b><small>No real payment is ever collected or stored in this demo.</small></span></div>
      </aside>
    </div>
  </div>;
}

function DriverPage({ online, setOnline, accepted, setAccepted, earnings: dailyEarnings, completedRides, onComplete, announce }: { online: boolean; setOnline: (v: boolean) => void; accepted: boolean; setAccepted: (v: boolean) => void; earnings: number; completedRides: number; onComplete: () => void; announce: (v: string, t?: Toast["tone"]) => void }) {
  const { user } = useAuth();
  const isDriver = user?.role === "driver";
  const driverName = isDriver ? user.fullName.split(" ")[0] : "Rashid";
  return <div className="driver-page"><PageHeading eyebrow="GORIDE · DRIVER STUDIO" title="Your road, your rules." copy="A clear view of your day, one journey at a time." action={<div className={`online-toggle ${online ? "is-online" : ""}`}><span>{online ? "You're online" : "You're offline"}</span><button onClick={() => { setOnline(!online); announce(!online ? "You're now online in the driver demo." : "You're offline. No new demo requests.", "info"); }} aria-label="Toggle driver availability"><i /></button></div>} /><div className="driver-profile-banner"><div className="driver-profile-avatar">{isDriver ? initials(user.fullName) : "RK"}<span><BadgeCheck size={13} /></span></div><div><div className="driver-verified"><BadgeCheck size={14} /> {isDriver ? `DRIVER · ${user.driver?.status === "approved" ? "VERIFIED" : "VERIFICATION PENDING"}` : "VERIFIED DEMO DRIVER"}</div><h2>Good morning, {driverName}.</h2><p>{isDriver && user.driver ? `${user.driver.vehicle} · ${user.driver.plateNumber}` : "Drive on your terms. We'll take care of the details."}</p>{!user && <Link className="text-link" to="/signup?role=driver">Sign up as a driver <ArrowRight size={14} /></Link>}</div><img className="driver-banner-art" src="/illustrations/drive-with-us.webp" alt="A smiling GoRide driver at the wheel" /></div><div className="driver-stats"><div><span className="driver-stat-icon green"><Wallet size={18} /></span><small>TODAY'S EARNINGS</small><b>AED {dailyEarnings.toFixed(2)}</b><em>↑ 12% from yesterday</em></div><div><span className="driver-stat-icon yellow"><CarFront size={18} /></span><small>COMPLETED RIDES</small><b>{completedRides}</b><em>2 more than your average</em></div><div><span className="driver-stat-icon blue"><Star size={18} /></span><small>PASSENGER RATING</small><b>4.96 <span className="stars-small">★</span></b><em>You're a passenger favourite</em></div></div><div className="driver-content-grid"><div className="panel earnings-panel"><div className="chart-heading"><div><span className="mini-kicker">YOUR MOMENTUM</span><h3>Weekly earnings</h3></div><button className="chart-select">This week <ChevronDown size={14} /></button></div><div className="chart-total">AED 2,470.80 <span>↑ 8.4%</span></div><div className="earnings-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={earnings} margin={{ left: 0, right: 6, top: 8, bottom: 0 }}><defs><linearGradient id="earningsFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#0d9c6a" stopOpacity={0.19} /><stop offset="95%" stopColor="#0d9c6a" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0ee" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#9ba6a1", fontSize: 11 }} dy={8} /><Tooltip formatter={(value) => [`AED ${value}`, "Earnings"]} contentStyle={{ borderRadius: 12, border: "1px solid #e8eeea", fontSize: 12 }} /><Area type="monotone" dataKey="value" stroke="#0d9c6a" strokeWidth={2.5} fill="url(#earningsFill)" /></AreaChart></ResponsiveContainer></div></div><div className={`ride-request-card ${!online ? "request-disabled" : ""}`}><div className="request-card-top"><span className="request-type"><span />{accepted ? "ACTIVE DEMO TRIP" : "INCOMING REQUEST"}</span><span className="request-timer">{online && !accepted ? "00:18" : "—"}</span></div><h3>{accepted ? "Passenger picked up" : online ? "A new journey awaits." : "You're off the clock."}</h3><p>{accepted ? "Amira Malik · 4.9 ★ · Demo passenger" : online ? "A nearby passenger could use a lift." : "Go online when you're ready to see demo requests."}</p><div className="request-route"><div><span className="route-start" /><b>Dubai Marina</b><small>Pickup · 1.2 km away</small></div><div><span className="route-end" /><b>Downtown Dubai</b><small>Drop-off · 14.2 km</small></div></div><div className="request-details"><span><Navigation size={14} /> 15.4 km total</span><span><Clock3 size={14} /> ~ 22 min</span><b>AED 46.50</b></div>{accepted ? <button className="btn-primary full-btn" onClick={() => { onComplete(); setAccepted(false); setOnline(false); announce("Demo trip completed. AED 46.50 added to mock earnings."); }}>Complete demo trip <Check size={15} /></button> : <div className="request-actions"><button className="btn-quiet" onClick={() => announce("Request declined. No passenger was waiting.", "info")}>Decline</button><button className="btn-primary" disabled={!online} onClick={() => { if (!accepted) { setAccepted(true); announce("Demo request accepted. Have a safe ride!"); } }}>Accept request <ArrowRight size={15} /></button></div>}<small className="request-disclaimer">Fictional request · No real passenger is waiting.</small></div></div><div className="driver-note"><ShieldCheck size={15} /> Driver profile, earnings, and ride requests are fictional demo data.</div></div>;
}

function ProfilePage({ darkMode, setDarkMode, announce, onLogout }: { darkMode: boolean; setDarkMode: (v: boolean) => void; announce: (v: string, t?: Toast["tone"]) => void; onLogout: () => void }) {
  const [notifications, setNotifications] = useState(true);
  const { user } = useAuth();
  return <div className="profile-page"><PageHeading eyebrow="IT'S YOUR GOJOURNEY" title="The details that make it yours." copy="Your account, preferences, and the little things." /><div className="profile-layout"><div className="profile-main"><div className="panel identity-card"><div className="identity-avatar">{user ? initials(user.fullName) : "AM"}<span><BadgeCheck size={13} /></span></div><div className="identity-copy"><span className="verified-chip"><BadgeCheck size={13} /> {user ? (user.role === "driver" ? "DRIVER ACCOUNT" : "RIDER ACCOUNT") : "DEMO ACCOUNT"}</span><h2>{user ? user.fullName : "Amira Malik"}</h2><p>{user ? [user.email, user.phone].filter(Boolean).join(" · ") : "amira.malik@example.com · +971 50 123 4567"}</p>{user?.driver && <p>{user.driver.vehicle} · {user.driver.plateNumber} · Verification {user.driver.status}</p>}{user ? <button className="text-link" onClick={onLogout}>Log out <ArrowRight size={14} /></button> : <Link className="text-link" to="/signup">Create your account <ArrowRight size={14} /></Link>}</div><button className="icon-btn" aria-label="More profile options" onClick={() => announce("Your account is a fictional demo profile.", "info")}><Ellipsis size={20} /></button></div><div className="panel settings-panel"><SectionTitle title="Your favourite places" action={<button className="add-method" onClick={() => announce("Saved places are demo-only.", "info")}><Plus size={14} /> Add place</button>} /><div className="saved-place"><span className="saved-icon home-icon"><Home size={17} /></span><span><b>Home</b><small>Dubai Marina, Marina Promenade</small></span><button className="text-link" onClick={() => announce("Saved place is demo-only.", "info")}>Edit</button></div><div className="saved-place"><span className="saved-icon work-icon"><span>⌘</span></span><span><b>Work</b><small>Business Bay, Bay Square</small></span><button className="text-link" onClick={() => announce("Saved place is demo-only.", "info")}>Edit</button></div></div>{user && <ChangePasswordPanel onDone={(m) => announce(m)} />}<div className="panel settings-panel"><SectionTitle title="Preferences" /><div className="preference-row"><span className="preference-icon"><Bell size={17} /></span><span><b>Ride notifications</b><small>Updates about your rides and offers</small></span><button className={`toggle ${notifications ? "toggle-on" : ""}`} onClick={() => setNotifications(!notifications)} aria-label="Toggle notifications"><i /></button></div><div className="preference-row"><span className="preference-icon"><Sparkles size={17} /></span><span><b>Appearance</b><small>Choose the look that feels right</small></span><button className={`toggle ${darkMode ? "toggle-on" : ""}`} onClick={() => setDarkMode(!darkMode)} aria-label="Toggle dark mode"><i /></button></div><div className="preference-row"><span className="preference-icon"><CreditCard size={17} /></span><span><b>Preferred payment</b><small>Visa ending in 4242</small></span><Link to="/wallet" className="text-link">Manage</Link></div><div className="preference-row"><span className="preference-icon"><MessageCircle size={17} /></span><span><b>Language</b><small>English (United Kingdom)</small></span><button className="text-link" onClick={() => announce("Language selection is simulated.", "info")}>Change</button></div></div></div><aside className="profile-aside"><div className="profile-perks"><div className="perk-spark"><Sparkles size={19} /></div><span className="mini-kicker">YOUR RIDER STATUS</span><h3>GoRide<br /><em>everyday.</em></h3><p>Every trip brings you closer to your next reward.</p><div className="perk-progress"><span><b>3</b> of 5 rides</span><span>2 to unlock</span><i><b /></i></div></div><div className="profile-links"><Link to="/safety"><ShieldCheck size={17} /> Privacy & safety <ChevronRight size={15} /></Link><Link to="/safety"><CircleHelp size={17} /> Help centre <ChevronRight size={15} /></Link>{user ? <button onClick={onLogout}><ArrowLeft size={17} /> Log out <ChevronRight size={15} /></button> : <Link to="/login"><ArrowLeft size={17} /> Log in <ChevronRight size={15} /></Link>}</div><div className="demo-account-note"><ShieldCheck size={15} /> {user ? "Your account details are stored securely. Rides, payments and trips are still a demo." : "You are viewing a sample profile. Log in or create an account to see your own."}</div></aside></div></div>;
}

function SafetyPage({ announce }: { announce: (v: string, t?: Toast["tone"]) => void }) {
  return <div className="safety-page"><PageHeading eyebrow="HERE WHEN YOU NEED US" title="You ride. We've got your back." copy="Your safety comes first, every mile of the way." /><div className="safety-hero"><div className="safety-shield"><ShieldCheck size={34} /></div><div><span className="mini-kicker">SAFETY, BUILT INTO EVERY RIDE</span><h2>Help is always<br />within reach.</h2><p>This is a demo emergency experience. No services are contacted.</p></div><button className="emergency-btn" onClick={() => announce("Demo only: emergency services were not contacted.", "info")}><span>!</span> Demo emergency help</button></div><div className="safety-feature-grid">{[{ icon: Navigation, title: "Share your trip", copy: "Let someone you trust follow along with your simulated journey.", action: "Share demo trip" }, { icon: ShieldCheck, title: "Ride with confidence", copy: "See driver and vehicle details before you meet your ride.", action: "Explore safety" }, { icon: Headphones, title: "We're here to help", copy: "Our support team is ready to help with your ride questions.", action: "Contact support" }].map(({ icon: Icon, title, copy, action }) => <div className="panel safety-feature" key={title}><span className="safety-feature-icon"><Icon size={19} /></span><h3>{title}</h3><p>{copy}</p><button className="text-link" onClick={() => announce(`${action} is simulated in this prototype.`, "info")}>{action} <ArrowRight size={14} /></button></div>)}</div><div className="safety-bottom-grid"><div className="panel safety-guidelines"><SectionTitle title="A few good-to-knows" /><div className="guideline"><span>01</span><div><b>Check your ride</b><p>Match the vehicle and plate with the details in your app.</p></div><Check size={16} /></div><div className="guideline"><span>02</span><div><b>Share the journey</b><p>Let a friend or family member know you're on your way.</p></div><Check size={16} /></div><div className="guideline"><span>03</span><div><b>Trust your instincts</b><p>If something doesn't feel right, end the trip and reach out.</p></div><Check size={16} /></div></div><div className="panel faq-panel"><SectionTitle title="Questions, answered" /><details><summary>Is this connected to real drivers? <ChevronDown size={15} /></summary><p>No. GoRide is a demonstration prototype. All driver profiles and trips are fictional.</p></details><details><summary>Can I make a real emergency call? <ChevronDown size={15} /></summary><p>No calls are placed. The emergency feature is clearly marked as a demo.</p></details><details><summary>How can I report a lost item? <ChevronDown size={15} /></summary><p>Contact support from this demo screen to see a simulated help confirmation.</p></details><button className="text-link" onClick={() => announce("Support is simulated. Thanks for getting in touch.", "info")}>More help topics <ArrowRight size={14} /></button></div></div><div className="safety-disclaimer"><ShieldCheck size={14} /> Demonstration only. Emergency, support, sharing, and contact actions do not contact external services.</div></div>;
}

export default App;
