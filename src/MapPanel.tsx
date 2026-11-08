import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { MapPin, Navigation } from "lucide-react";
import { places } from "./data";

type Props = { pickup: string; destination: string; stop?: string; tracking?: boolean; progress?: number; compact?: boolean };

const icon = (kind: "pickup" | "destination" | "car" | "stop") => L.divIcon({
  className: `map-marker map-marker-${kind}`,
  html: kind === "car" ? '<span class="car-pin">⌁</span>' : `<span class="pin-dot ${kind}"></span>`,
  iconSize: kind === "car" ? [36, 36] : [24, 24],
  iconAnchor: kind === "car" ? [18, 18] : [12, 12],
});

function FitRoute({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [48, 48], maxZoom: 13, animate: false });
  }, [map, points]);
  return null;
}

export default function MapPanel({ pickup, destination, stop, tracking = false, progress = 0.48, compact = false }: Props) {
  const [tileError, setTileError] = useState(false);
  const origin = places.find((place) => place.name === pickup)?.coords ?? places[0].coords;
  const end = places.find((place) => place.name === destination)?.coords ?? places[1].coords;
  const via = stop ? places.find((place) => place.name === stop)?.coords : undefined;
  const bounds = useMemo(() => (via ? [origin, via, end] : [origin, end]) as [number, number][], [origin, via, end]);
  const route = useMemo<[number, number][]>(() => via ? [origin, via, end] : [origin, [(origin[0] + end[0]) / 2 + 0.008, (origin[1] + end[1]) / 2 - 0.012], end], [origin, via, end]);
  const along = (t: number): [number, number] => {
    const legs = route.slice(1).map((p, i) => Math.hypot(p[0] - route[i][0], p[1] - route[i][1]));
    let d = t * legs.reduce((a, b) => a + b, 0);
    for (let i = 0; i < legs.length; i++) { if (d <= legs[i] || i === legs.length - 1) { const f = legs[i] ? Math.min(1, d / legs[i]) : 0; return [route[i][0] + (route[i + 1][0] - route[i][0]) * f, route[i][1] + (route[i + 1][1] - route[i][1]) * f]; } d -= legs[i]; }
    return end;
  };
  const driverPosition = along(progress);
  const vehicles = [[25.089, 55.146], [25.19, 55.252], [25.16, 55.289], [25.075, 55.128]] as [number, number][];

  return (
    <div className={`map-frame ${compact ? "map-frame-compact" : ""} ${tileError ? "tiles-unavailable" : ""}`}>
      <MapContainer center={[25.14, 55.23]} zoom={12} scrollWheelZoom={false} zoomControl={!compact} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{ tileerror: () => setTileError(true) }} />
        <FitRoute points={bounds} />
        <Polyline positions={route} pathOptions={{ color: "#0f9f6e", weight: 5, opacity: 0.85, dashArray: "1 0" }} />
        <Polyline positions={route} pathOptions={{ color: "#ffffff", weight: 2, opacity: 0.8, dashArray: "5 10" }} />
        <Marker position={origin} icon={icon("pickup")} />
        <Marker position={end} icon={icon("destination")} />
        {via && <Marker position={via} icon={icon("stop")} />}
        {tracking ? <Marker position={driverPosition} icon={icon("car")} /> : vehicles.map((position, index) => <Marker key={index} position={position} icon={icon("car")} />)}
      </MapContainer>
      <div className="map-live-tag"><span className="live-dot" /> {tileError ? "Fallback map · Dubai" : "Demo map · Dubai"}</div>
      {!compact && <div className="map-location-card"><span className="location-symbol"><Navigation size={16} /></span><span><b>{pickup}</b><small>Pickup location</small></span><MapPin size={16} className="muted-icon" /></div>}
      <div className="map-attribution">© OpenStreetMap contributors</div>
    </div>
  );
}
