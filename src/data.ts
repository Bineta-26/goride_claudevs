export type Place = { name: string; detail: string; coords: [number, number]; city?: string };

export const places: Place[] = [
  { name: "Dubai Marina", detail: "Dubai Marina, Dubai", coords: [25.0805, 55.1403] },
  { name: "Downtown Dubai", detail: "Burj Khalifa area, Dubai", coords: [25.1972, 55.2744] },
  { name: "Business Bay", detail: "Business Bay, Dubai", coords: [25.1851, 55.263] },
  { name: "JBR", detail: "Jumeirah Beach Residence, Dubai", coords: [25.078, 55.133] },
  { name: "Dubai International Airport", detail: "Terminal 3, Dubai", coords: [25.2532, 55.3657] },
  { name: "Abu Dhabi Corniche", detail: "Corniche Road, Abu Dhabi", coords: [24.4774, 54.354] },
  { name: "Yas Island", detail: "Yas Island, Abu Dhabi", coords: [24.4934, 54.607] },
  { name: "Dubai Mall", detail: "Financial Centre Rd, Downtown Dubai", coords: [25.1985, 55.2796] },
  { name: "DIFC", detail: "Dubai International Financial Centre", coords: [25.2125, 55.2817] },
  { name: "Jumeirah Lakes Towers", detail: "JLT, Dubai", coords: [25.0693, 55.1413] },
  { name: "Mall of the Emirates", detail: "Al Barsha, Dubai", coords: [25.1181, 55.2006] },
  { name: "Dubai Creek Harbour", detail: "Ras Al Khor, Dubai", coords: [25.2048, 55.3434] },
  { name: "Al Majaz Waterfront", detail: "Al Majaz, Sharjah", coords: [25.3255, 55.3853] },
  { name: "Sharjah City Centre", detail: "Al Wahda St, Sharjah", coords: [25.3256, 55.4222] },
  { name: "University City Sharjah", detail: "University City, Sharjah", coords: [25.2867, 55.4766] },
];
export const cityOf = (place: Place) => place.detail.includes("Sharjah") ? "Sharjah" : place.detail.includes("Abu Dhabi") ? "Abu Dhabi" : "Dubai";

export const rideTypes = [
  { id: "economy", name: "GoRide Economy", short: "Economy", detail: "Affordable everyday rides", price: 1, eta: "3 min", duration: "18 min", capacity: "1–4", image: "sedan" },
  { id: "comfort", name: "GoRide Comfort", short: "Comfort", detail: "A little more room to relax", price: 1.28, eta: "5 min", duration: "16 min", capacity: "1–4", image: "comfort" },
  { id: "premium", name: "GoRide Premium", detail: "Arrive in effortless style", short: "Premium", price: 1.9, eta: "7 min", duration: "15 min", capacity: "1–3", image: "premium" },
  { id: "xl", name: "GoRide XL", detail: "Space for your whole crew", short: "XL", price: 1.55, eta: "6 min", duration: "20 min", capacity: "1–6", image: "xl" },
  { id: "green", name: "GoRide Green", detail: "A lighter way to get there", short: "Green", price: 1.18, eta: "4 min", duration: "18 min", capacity: "1–4", image: "green" },
];

export type Booking = {
  id: string;
  pickup: string;
  destination: string;
  category: string;
  fare: number;
  payment?: string;
  date: string;
  status: "Scheduled" | "Completed" | "In progress" | "Cancelled";
  stop?: string;
  distanceKm?: number;
  rideId?: string;
  changes?: string[];
  rating?: number;
};

/** Distance for a route that may go through one extra stop. */
export function routeKm(pickup: string, destination: string, stop?: string) {
  return stop ? Math.round((getRouteDistanceKm(pickup, stop) + getRouteDistanceKm(stop, destination)) * 10) / 10 : getRouteDistanceKm(pickup, destination);
}

export const seedTrips: Booking[] = [
  { id: "GR-2048", pickup: "Dubai Marina", destination: "Downtown Dubai", category: "GoRide Comfort", fare: 42, date: "Today, 9:14 AM", status: "Completed" },
  { id: "GR-2047", pickup: "JBR", destination: "Business Bay", category: "GoRide Economy", fare: 36, date: "Yesterday, 6:32 PM", status: "Completed" },
  { id: "GR-2046", pickup: "Downtown Dubai", destination: "Dubai International Airport", category: "GoRide Premium", fare: 78, date: "Oct 28, 8:05 AM", status: "Completed" },
];

export const routeDistanceKm = 14.2;
export function getRouteDistanceKm(pickup: string, destination: string) {
  const origin = places.find((place) => place.name === pickup)?.coords;
  const target = places.find((place) => place.name === destination)?.coords;
  if (!origin || !target) return routeDistanceKm;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(target[0] - origin[0]);
  const longitudeDelta = radians(target[1] - origin[1]);
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(origin[0])) * Math.cos(radians(target[0])) * Math.sin(longitudeDelta / 2) ** 2;
  const straightLineKm = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Math.max(2.4, Math.round(straightLineKm * 1.1 * 10) / 10);
}

export const estimateFare = (categoryId: string, distanceKm = routeDistanceKm, promo = false) => {
  const ride = rideTypes.find((type) => type.id === categoryId) ?? rideTypes[0];
  const fare = (12 + distanceKm * 2.15) * ride.price;
  return Math.round((promo ? fare * 0.85 : fare) * 100) / 100;
};
