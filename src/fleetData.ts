// Fleet performance: sample drivers, sample trips and KPI rules for the admin portal.
// All figures produced here are SAMPLE data for the demo. Real trips will replace them once trips are stored.

import { places } from "./data";

export type SampleDriver = {
  key: string; // stable id used for cost records
  fullName: string;
  phone: string;
  email: string;
  vehicle: string;
  plateNumber: string;
  licenseNumber: string;
  joined: string;
  rating: number;
  home: [number, number];
  utilisation: number; // share of online time spent on paid trips (drives performance spread)
  daysPerWeek: number;
  hoursPerDay: number;
  sample: true;
};

export type Trip = { id: string; date: string; pickup: string; destination: string; km: number; minutes: number; fare: number };

export type MonthStats = {
  trips: Trip[];
  tripCount: number;
  km: number; // total km driven (paid + empty km to pick-ups)
  paidKm: number;
  hours: number; // hours online
  revenue: number; // fares collected for the company (AED)
  daily: { day: string; revenue: number; hours: number }[];
};

export type Costs = { fuel: number; maintenance: number; entered: boolean };

export type KpiSettings = { breakEven: number; target: number; excellent: number; maxCostShare: number; fuelPerKm: number; maintenancePerKm: number };

/** Default KPI thresholds (AED). Estimates for a Dubai sedan — editable by the admin. */
export const DEFAULT_KPI: KpiSettings = { breakEven: 45, target: 60, excellent: 75, maxCostShare: 25, fuelPerKm: 0.25, maintenancePerKm: 0.17 };

export const sampleDrivers: SampleDriver[] = [
  { key: "sample-01", fullName: "Omar Al Hashimi", phone: "+971 50 214 7781", email: "omar.h@sample.goride.ae", vehicle: "Toyota Camry 2024", plateNumber: "Dubai K 48213", licenseNumber: "DXB-5521984", joined: "2026-02-11", rating: 4.92, home: [25.0805, 55.1403], utilisation: 0.74, daysPerWeek: 6, hoursPerDay: 9, sample: true },
  { key: "sample-02", fullName: "Rajesh Kumar", phone: "+971 55 803 1129", email: "rajesh.k@sample.goride.ae", vehicle: "Hyundai Sonata 2023", plateNumber: "Dubai M 77102", licenseNumber: "DXB-4410276", joined: "2026-01-04", rating: 4.88, home: [25.1972, 55.2744], utilisation: 0.66, daysPerWeek: 6, hoursPerDay: 10, sample: true },
  { key: "sample-03", fullName: "Fatima Zahra Benali", phone: "+971 52 660 4410", email: "fatima.b@sample.goride.ae", vehicle: "Toyota Camry Hybrid 2025", plateNumber: "Dubai P 30988", licenseNumber: "DXB-6013357", joined: "2026-04-19", rating: 4.97, home: [25.1851, 55.263], utilisation: 0.79, daysPerWeek: 5, hoursPerDay: 8, sample: true },
  { key: "sample-04", fullName: "Joseph Mensah", phone: "+971 56 119 2287", email: "joseph.m@sample.goride.ae", vehicle: "Kia K5 2023", plateNumber: "Dubai L 15530", licenseNumber: "DXB-3398120", joined: "2025-11-27", rating: 4.71, home: [25.2532, 55.3657], utilisation: 0.52, daysPerWeek: 6, hoursPerDay: 9, sample: true },
  { key: "sample-05", fullName: "Ahmed Saeed", phone: "+971 50 772 0954", email: "ahmed.s@sample.goride.ae", vehicle: "Nissan Altima 2022", plateNumber: "Dubai H 90417", licenseNumber: "DXB-2876603", joined: "2025-09-08", rating: 4.63, home: [25.078, 55.133], utilisation: 0.41, daysPerWeek: 5, hoursPerDay: 8, sample: true },
  { key: "sample-06", fullName: "Mariam Yousef", phone: "+971 58 345 6612", email: "mariam.y@sample.goride.ae", vehicle: "Lexus ES 300h 2025", plateNumber: "Dubai A 22675", licenseNumber: "DXB-7140431", joined: "2026-06-02", rating: 4.95, home: [25.2048, 55.2708], utilisation: 0.83, daysPerWeek: 5, hoursPerDay: 9, sample: true },
  { key: "sample-07", fullName: "Carlos Mendoza", phone: "+971 54 908 3371", email: "carlos.m@sample.goride.ae", vehicle: "Toyota Corolla 2023", plateNumber: "Dubai R 61204", licenseNumber: "DXB-5098812", joined: "2026-03-15", rating: 4.80, home: [25.118, 55.2], utilisation: 0.58, daysPerWeek: 6, hoursPerDay: 8, sample: true },
  { key: "sample-08", fullName: "Yusuf Demir", phone: "+971 55 431 7720", email: "yusuf.d@sample.goride.ae", vehicle: "Chevrolet Malibu 2022", plateNumber: "Dubai G 47359", licenseNumber: "DXB-1987745", joined: "2025-12-20", rating: 4.58, home: [25.23, 55.32], utilisation: 0.47, daysPerWeek: 6, hoursPerDay: 10, sample: true },
];

/** Small deterministic random generator so the sample figures stay the same on every visit. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}

const dubaiPlaces = places.filter((p) => p.coords[0] > 24.9);
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export function recentMonths(count = 6, from = new Date()) {
  return Array.from({ length: count }, (_, i) => monthKey(new Date(from.getFullYear(), from.getMonth() - i, 1)));
}
export const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-AE", { month: "long", year: "numeric" });

/** Fare model used for samples: AED 12 flag fall + AED 2.2 per km + AED 0.5 per minute, minimum AED 25. */
export const fareFor = (km: number, minutes: number) => Math.max(25, 12 + km * 2.2 + minutes * 0.5);

export function sampleMonth(driver: SampleDriver, month: string, today = new Date()): MonthStats {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrent = monthKey(today) === month;
  const lastDay = isCurrent ? today.getDate() : daysInMonth;
  const joined = new Date(`${driver.joined}T00:00:00`);
  const rand = rng(`${driver.key}:${month}`);
  const trips: Trip[] = [];
  const daily: MonthStats["daily"] = [];
  let km = 0; let paidKm = 0; let hours = 0; let revenue = 0;
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(y, m - 1, day);
    const label = `${day} ${date.toLocaleDateString("en-AE", { month: "short" })}`;
    if (date < joined || rand() > driver.daysPerWeek / 7) { daily.push({ day: label, revenue: 0, hours: 0 }); continue; }
    const online = Math.max(4, driver.hoursPerDay + (rand() - 0.5) * 3);
    const busyMinutes = online * 60 * Math.min(0.92, Math.max(0.2, driver.utilisation + (rand() - 0.5) * 0.12));
    let used = 0; let dayRevenue = 0;
    while (used < busyMinutes) {
      const a = dubaiPlaces[Math.floor(rand() * dubaiPlaces.length)];
      let b = dubaiPlaces[Math.floor(rand() * dubaiPlaces.length)];
      if (b === a) b = dubaiPlaces[(dubaiPlaces.indexOf(a) + 1) % dubaiPlaces.length];
      const tripKm = round(4 + rand() * 24);
      const minutes = Math.round(tripKm * (1.7 + rand() * 1.1) + 4);
      const fare = round(fareFor(tripKm, minutes), 2);
      const hour = 7 + Math.floor((used / busyMinutes) * online);
      trips.push({ id: `GR-${month.replace("-", "").slice(2)}${driver.key.slice(-2)}${String(trips.length + 1).padStart(3, "0")}`, date: `${label}, ${String(Math.min(hour, 23)).padStart(2, "0")}:${String(Math.floor(rand() * 60)).padStart(2, "0")}`, pickup: a.name, destination: b.name, km: tripKm, minutes, fare });
      const emptyKm = 2 + rand() * 4; // driving to the pick-up
      paidKm += tripKm; km += tripKm + emptyKm; dayRevenue += fare;
      used += minutes + 8;
    }
    hours += online; revenue += dayRevenue;
    daily.push({ day: label, revenue: round(dayRevenue, 0), hours: round(online) });
  }
  return { trips: trips.reverse(), tripCount: trips.length, km: round(km, 0), paidKm: round(paidKm, 0), hours: round(hours), revenue: round(revenue, 0), daily };
}

export const emptyMonth = (): MonthStats => ({ trips: [], tripCount: 0, km: 0, paidKm: 0, hours: 0, revenue: 0, daily: [] });

export function estimatedCosts(stats: MonthStats, kpi: KpiSettings): Costs {
  return { fuel: Math.round(stats.km * kpi.fuelPerKm), maintenance: Math.round(stats.km * kpi.maintenancePerKm), entered: false };
}

export type Tier = "none" | "below" | "breakeven" | "target" | "excellent";
export function tierFor(revenuePerHour: number, hours: number, kpi: KpiSettings): Tier {
  if (!hours) return "none";
  if (revenuePerHour >= kpi.excellent) return "excellent";
  if (revenuePerHour >= kpi.target) return "target";
  if (revenuePerHour >= kpi.breakEven) return "breakeven";
  return "below";
}
export const tierLabel: Record<Tier, string> = { none: "No activity", below: "Below break-even", breakeven: "Break-even", target: "On target", excellent: "Excellent" };

export function summarise(stats: MonthStats, costs: Costs, kpi: KpiSettings) {
  const totalCost = costs.fuel + costs.maintenance;
  const revenuePerHour = stats.hours ? stats.revenue / stats.hours : 0;
  const profit = stats.revenue - totalCost;
  return {
    revenuePerHour: round(revenuePerHour, 1),
    revenuePerKm: stats.km ? round(stats.revenue / stats.km, 2) : 0,
    totalCost,
    profit,
    profitPerHour: stats.hours ? round(profit / stats.hours, 1) : 0,
    costPerKm: stats.km ? round(totalCost / stats.km, 2) : 0,
    costShare: stats.revenue ? round((totalCost / stats.revenue) * 100, 1) : 0,
    tier: tierFor(revenuePerHour, stats.hours, kpi),
    costOk: stats.revenue ? (totalCost / stats.revenue) * 100 <= kpi.maxCostShare : true,
  };
}

/** Simulated live position: drives in a slow loop around the driver's area. */
export function livePosition(driver: SampleDriver, t = Date.now()): { position: [number, number]; online: boolean; heading: number } {
  const rand = rng(driver.key);
  const phase = rand() * Math.PI * 2;
  const radius = 0.012 + rand() * 0.02;
  const speed = 0.00004 + rand() * 0.00003; // radians per second
  const angle = phase + (t / 1000) * speed * 10;
  const hour = new Date(t).getHours();
  const online = driver.utilisation > 0.45 ? true : hour >= 7 && hour < 22;
  return { position: [driver.home[0] + Math.sin(angle) * radius, driver.home[1] + Math.cos(angle) * radius * 1.3], online, heading: (angle * 180) / Math.PI };
}

export const aed = (n: number) => `AED ${Math.round(n).toLocaleString("en-AE")}`;
