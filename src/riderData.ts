// Per-rider data for the GoRide demo: each signed-in rider gets their own trips, wallet, saved places,
// payment methods, notifications and support tickets (kept in this browser). Two example riders are pre-filled.
import { useCallback, useEffect, useState } from "react";
import { estimateFare, routeKm, rideTypes, seedTrips, type Booking } from "./data";

export type SavedPlace = { id: string; label: string; place: string; icon: "home" | "work" | "star" };
export type PaymentMethod = { id: string; kind: "card" | "cash" | "wallet"; brand: string; last4?: string; expiry?: string; nickname?: string; isDefault?: boolean };
export type Notice = { id: string; title: string; body: string; time: string; read: boolean; link?: string };
export type Ticket = { id: string; topic: string; message: string; tripId?: string; date: string; status: "Open" | "Answered" | "Closed"; reply?: string };
export type TopUp = { id: string; date: string; amount: number; method: string };
export type Lang = "en" | "ar";

export type RiderData = {
  trips: Booking[];
  schedule: Booking[];
  active: Booking | null;
  wallet: number;
  credits: number;
  saved: SavedPlace[];
  methods: PaymentMethod[];
  notices: Notice[];
  tickets: Ticket[];
  topups: TopUp[];
  lang: Lang;
  city: string;
  darkMode: boolean;
  notifyRides: boolean;
};

export const DEMO_EMAILS = { aisha: "aisha.rahman@demo.goride.ae", daniel: "daniel.okafor@demo.goride.ae" };

const uid = () => Math.random().toString(36).slice(2, 9);
const day = (offset: number, h: number, m: number) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(h, m, 0, 0); return d; };
export const fmtDate = (d: Date) => d.toLocaleString("en-AE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const nowText = () => fmtDate(new Date());

function trip(id: string, pickup: string, destination: string, rideId: string, offset: number, h: number, m: number, status: Booking["status"] = "Completed", payment = "Visa ···· 4242", rating?: number): Booking {
  const ride = rideTypes.find((r) => r.id === rideId) ?? rideTypes[0];
  const distanceKm = routeKm(pickup, destination);
  return { id, pickup, destination, category: ride.name, rideId, fare: estimateFare(rideId, distanceKm), payment, date: fmtDate(day(offset, h, m)), status, distanceKm, rating };
}

const baseMethods: PaymentMethod[] = [
  { id: "visa", kind: "card", brand: "Visa", last4: "4242", expiry: "08/28", isDefault: true },
  { id: "cash", kind: "cash", brand: "Cash" },
  { id: "wallet", kind: "wallet", brand: "GoRide Wallet" },
];

function emptyData(): RiderData {
  return { trips: [], schedule: [], active: null, wallet: 0, credits: 25, saved: [], methods: baseMethods, notices: [
    { id: uid(), title: "Welcome to GoRide", body: "Your account is ready. Book your first ride and use RIDE15 for 15% off.", time: nowText(), read: false, link: "/book" },
  ], tickets: [], topups: [], lang: "en", city: "Dubai", darkMode: false, notifyRides: true };
}

function aishaData(): RiderData {
  return {
    ...emptyData(),
    trips: [
      trip("GR-4821", "Dubai Marina", "DIFC", "comfort", -1, 7, 52, "Completed", "Visa ···· 4242", 5),
      trip("GR-4807", "DIFC", "Dubai Marina", "economy", -1, 18, 34, "Completed", "Visa ···· 4242", 5),
      trip("GR-4772", "Dubai Marina", "JBR", "green", -3, 6, 15, "Completed", "GoRide Wallet", 4),
      trip("GR-4750", "Dubai Marina", "Mall of the Emirates", "comfort", -5, 16, 10, "Completed", "Mastercard ···· 5100", 5),
      trip("GR-4719", "Dubai Marina", "DIFC", "comfort", -8, 7, 48, "Completed", "Visa ···· 4242", 5),
      trip("GR-4702", "Downtown Dubai", "Dubai Marina", "economy", -9, 22, 5, "Cancelled", "Visa ···· 4242"),
      trip("GR-4688", "Dubai Marina", "Dubai Mall", "comfort", -12, 13, 30, "Completed", "Visa ···· 4242", 4),
      trip("GR-4640", "Jumeirah Lakes Towers", "Dubai Marina", "economy", -20, 19, 12, "Completed", "Cash", 5),
    ],
    schedule: [trip("GR-5103", "Dubai Marina", "DIFC", "comfort", 1, 7, 45, "Scheduled")],
    wallet: 312.75,
    credits: 25,
    saved: [
      { id: "home", label: "Home", place: "Dubai Marina", icon: "home" },
      { id: "work", label: "Work", place: "DIFC", icon: "work" },
      { id: "gym", label: "Gym", place: "JBR", icon: "star" },
    ],
    methods: [
      { id: "visa", kind: "card", brand: "Visa", last4: "4242", expiry: "08/28", isDefault: true, nickname: "Personal" },
      { id: "mc", kind: "card", brand: "Mastercard", last4: "5100", expiry: "11/27" },
      { id: "cash", kind: "cash", brand: "Cash" },
      { id: "wallet", kind: "wallet", brand: "GoRide Wallet" },
    ],
    notices: [
      { id: uid(), title: "Ride tomorrow at 7:45 AM", body: "Dubai Marina → DIFC is booked. Your driver will be assigned 15 minutes before pickup.", time: fmtDate(day(0, 8, 0)), read: false, link: "/scheduled" },
      { id: uid(), title: "Receipt for GR-4821", body: "Your Comfort ride to DIFC cost AED " + estimateFare("comfort", routeKm("Dubai Marina", "DIFC")).toFixed(2) + ".", time: fmtDate(day(-1, 8, 20)), read: false, link: "/trips" },
      { id: uid(), title: "You unlocked a reward", body: "3 rides this week. AED 25 ride credit has been added to your wallet.", time: fmtDate(day(-2, 9, 0)), read: true, link: "/wallet" },
    ],
    tickets: [{ id: "T-1042", topic: "Lost item", message: "I left a blue umbrella in the car on my ride to Mall of the Emirates.", tripId: "GR-4750", date: fmtDate(day(-5, 18, 2)), status: "Answered", reply: "Good news, Aisha. The driver found your umbrella. We will return it to Dubai Marina tomorrow between 10 AM and 12 PM." }],
    topups: [{ id: uid(), date: fmtDate(day(-14, 10, 0)), amount: 200, method: "Visa ···· 4242" }],
  };
}

function danielData(): RiderData {
  return {
    ...emptyData(),
    trips: [
      trip("GR-4830", "Business Bay", "Dubai International Airport", "premium", 0, 5, 40, "Completed", "Amex ···· 1005", 5),
      trip("GR-4795", "Dubai International Airport", "DIFC", "premium", -2, 21, 15, "Completed", "Amex ···· 1005", 5),
      trip("GR-4781", "DIFC", "Business Bay", "comfort", -3, 19, 5, "Completed", "Amex ···· 1005", 4),
      trip("GR-4760", "Business Bay", "Dubai Creek Harbour", "xl", -4, 12, 30, "Completed", "Amex ···· 1005", 5),
      trip("GR-4733", "Business Bay", "Abu Dhabi Corniche", "premium", -6, 7, 0, "Completed", "Amex ···· 1005", 5),
      trip("GR-4731", "Abu Dhabi Corniche", "Business Bay", "premium", -6, 17, 45, "Completed", "Amex ···· 1005", 5),
      trip("GR-4698", "Business Bay", "Dubai International Airport", "premium", -10, 4, 50, "Completed", "Amex ···· 1005", 5),
      trip("GR-4690", "Dubai International Airport", "Business Bay", "premium", -13, 23, 30, "Completed", "Amex ···· 1005", 4),
      trip("GR-4655", "Business Bay", "Sharjah City Centre", "comfort", -17, 15, 20, "Cancelled", "Amex ···· 1005"),
    ],
    schedule: [
      trip("GR-5121", "Business Bay", "Dubai International Airport", "premium", 2, 5, 15, "Scheduled", "Amex ···· 1005"),
      trip("GR-5129", "Dubai International Airport", "Business Bay", "premium", 5, 22, 40, "Scheduled", "Amex ···· 1005"),
    ],
    wallet: 1180,
    credits: 0,
    saved: [
      { id: "home", label: "Home", place: "Business Bay", icon: "home" },
      { id: "office", label: "Office", place: "DIFC", icon: "work" },
      { id: "airport", label: "Airport T3", place: "Dubai International Airport", icon: "star" },
    ],
    methods: [
      { id: "amex", kind: "card", brand: "Amex", last4: "1005", expiry: "03/29", nickname: "Corporate", isDefault: true },
      { id: "visa", kind: "card", brand: "Visa", last4: "4242", expiry: "08/28", nickname: "Personal" },
      { id: "cash", kind: "cash", brand: "Cash" },
      { id: "wallet", kind: "wallet", brand: "GoRide Wallet" },
    ],
    notices: [
      { id: uid(), title: "Airport ride in 2 days", body: "Business Bay → DXB Terminal 3 at 5:15 AM. Premium driver will meet you at the lobby.", time: fmtDate(day(0, 6, 0)), read: false, link: "/scheduled" },
      { id: uid(), title: "Monthly business summary", body: "Your corporate rides this month are ready to export from Your trips.", time: fmtDate(day(-1, 9, 0)), read: false, link: "/trips" },
    ],
    tickets: [{ id: "T-1051", topic: "Receipt / billing", message: "Please add my company name 'Okafor Advisory' to the invoices.", date: fmtDate(day(-3, 11, 20)), status: "Closed", reply: "Done, Daniel. All future receipts will show Okafor Advisory." }],
    topups: [{ id: uid(), date: fmtDate(day(-9, 9, 30)), amount: 1000, method: "Amex ···· 1005" }],
    lang: "en",
  };
}

function guestData(): RiderData {
  const legacy = (k: string, f: unknown) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } };
  return { ...emptyData(), trips: legacy("goride-trips", seedTrips), schedule: legacy("goride-schedule", []), active: legacy("goride-active", null), wallet: legacy("goride-wallet", 245.5), darkMode: legacy("goride-dark", false), saved: [{ id: "home", label: "Home", place: "Dubai Marina", icon: "home" }, { id: "work", label: "Work", place: "Business Bay", icon: "work" }] };
}

function seedFor(email?: string): RiderData {
  if (email === DEMO_EMAILS.aisha) return aishaData();
  if (email === DEMO_EMAILS.daniel) return danielData();
  return email ? emptyData() : guestData();
}

const storageKey = (id: string | undefined) => `goride:v2:${id ?? "guest"}`;
function load(id: string | undefined, email?: string): RiderData {
  try { const raw = localStorage.getItem(storageKey(id)); if (raw) return { ...seedFor(email), ...JSON.parse(raw) }; } catch { /* storage unavailable */ }
  return seedFor(email);
}

/** The signed-in rider's data (or a guest copy), saved per account in this browser. */
export function useRiderData(id: string | undefined, email: string | undefined, ready: boolean) {
  const key = ready ? storageKey(id) : "pending";
  const [state, setState] = useState(() => ({ key, data: ready ? load(id, email) : guestData() }));
  if (state.key !== key) setState({ key, data: ready ? load(id, email) : guestData() });
  useEffect(() => {
    if (state.key === "pending" || state.key !== key) return;
    try { localStorage.setItem(state.key, JSON.stringify(state.data)); } catch { /* storage unavailable */ }
  }, [state, key]);
  const update = useCallback((fn: (d: RiderData) => RiderData) => setState((s) => ({ ...s, data: fn(s.data) })), []);
  const reset = useCallback(() => setState((s) => ({ ...s, data: seedFor(email) })), [email]);
  return { data: state.data, update, reset };
}

export const methodLabel = (m: PaymentMethod) => m.kind === "card" ? `${m.brand} ···· ${m.last4}` : m.brand;
export const newId = uid;
