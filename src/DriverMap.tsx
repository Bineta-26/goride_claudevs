import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";

export type MapDriver = { key: string; name: string; position: [number, number]; online: boolean; selected?: boolean };

declare const __GOOGLE_MAPS_API_KEY__: string;
const GOOGLE_KEY = (typeof __GOOGLE_MAPS_API_KEY__ === "string" ? __GOOGLE_MAPS_API_KEY__ : "").trim();
export const usingGoogleMaps = !!GOOGLE_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type G = any;
declare global { interface Window { google?: G; __goRideMapsReady?: () => void } }

let loader: Promise<G> | null = null;
function loadGoogleMaps(): Promise<G> {
  if (window.google?.maps) return Promise.resolve(window.google);
  loader ??= new Promise((resolve, reject) => {
    window.__goRideMapsReady = () => resolve(window.google);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&callback=__goRideMapsReady&loading=async`;
    script.async = true;
    script.onerror = () => { loader = null; reject(new Error("Google Maps failed to load")); };
    document.head.appendChild(script);
  });
  return loader;
}

const pinSvg = (online: boolean, selected: boolean) => {
  const fill = !online ? "#9aa59f" : selected ? "#c8f568" : "#10865e";
  const stroke = selected ? "#1d2a24" : "#ffffff";
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38"><circle cx="19" cy="19" r="${selected ? 16 : 13}" fill="${fill}" stroke="${stroke}" stroke-width="3"/><path d="M12 21.5l1.6-4.4c.3-.8 1-1.3 1.9-1.3h7c.9 0 1.6.5 1.9 1.3l1.6 4.4v3.2h-2v-1.4h-10v1.4h-2z" fill="${selected ? "#1d2a24" : "#fff"}"/></svg>`)}`;
};

function GoogleDriverMap({ drivers, onSelect, focus }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<G>(null);
  const markers = useRef<Map<string, G>>(new Map());
  const [failed, setFailed] = useState(false);
  const fitted = useRef(false);
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((google) => {
      if (cancelled || !el.current) return;
      map.current = new google.maps.Map(el.current, { center: { lat: 25.15, lng: 55.25 }, zoom: 11, mapTypeControl: false, streetViewControl: false, fullscreenControl: true, clickableIcons: false });
      setReady((n) => n + 1);
    }).catch(() => setFailed(true));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const google = window.google;
    if (!map.current || !google) return;
    const seen = new Set<string>();
    drivers.forEach((d) => {
      seen.add(d.key);
      const icon = { url: pinSvg(d.online, !!d.selected), scaledSize: new google.maps.Size(38, 38), anchor: new google.maps.Point(19, 19) };
      let marker = markers.current.get(d.key);
      if (!marker) {
        marker = new google.maps.Marker({ map: map.current, title: d.name });
        if (onSelect) marker.addListener("click", () => onSelect(d.key));
        markers.current.set(d.key, marker);
      }
      marker.setPosition({ lat: d.position[0], lng: d.position[1] });
      marker.setIcon(icon);
      marker.setZIndex(d.selected ? 10 : 1);
    });
    markers.current.forEach((m, key) => { if (!seen.has(key)) { m.setMap(null); markers.current.delete(key); } });
    if (!fitted.current && drivers.length) {
      fitted.current = true;
      if (focus) { map.current.setCenter({ lat: focus[0], lng: focus[1] }); map.current.setZoom(14); }
      else { const b = new google.maps.LatLngBounds(); drivers.forEach((d) => b.extend({ lat: d.position[0], lng: d.position[1] })); map.current.fitBounds(b, 48); }
    }
  }, [drivers, ready, onSelect, focus]);

  if (failed) return <LeafletDriverMap drivers={drivers} onSelect={onSelect} focus={focus} note="Google Maps could not load — showing the backup map" />;
  return <div className="fleet-map"><div ref={el} className="fleet-map-canvas" /><div className="map-live-tag"><span className="live-dot" /> Live · Google Maps</div></div>;
}

function FitOnce({ points, focus }: { points: [number, number][]; focus?: [number, number] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !points.length) return;
    done.current = true;
    if (focus) map.setView(focus, 14); else map.fitBounds(points, { padding: [40, 40], maxZoom: 13 });
  }, [map, points, focus]);
  return null;
}

const leafletIcon = (online: boolean, selected: boolean) => L.icon({ iconUrl: pinSvg(online, selected), iconSize: [38, 38], iconAnchor: [19, 19] });

function LeafletDriverMap({ drivers, onSelect, focus, note }: Props & { note?: string }) {
  return <div className="fleet-map">
    <MapContainer center={[25.15, 55.25]} zoom={11} scrollWheelZoom attributionControl={false} className="fleet-map-canvas">
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitOnce points={drivers.map((d) => d.position)} focus={focus} />
      {drivers.map((d) => <Marker key={d.key} position={d.position} icon={leafletIcon(d.online, !!d.selected)} zIndexOffset={d.selected ? 1000 : 0} eventHandlers={onSelect ? { click: () => onSelect(d.key) } : undefined}><Tooltip direction="top" offset={[0, -14]}>{d.name}</Tooltip></Marker>)}
    </MapContainer>
    <div className="map-live-tag"><span className="live-dot" /> {note ?? "Live · backup map (add a Google Maps key)"}</div>
    <div className="map-attribution">© OpenStreetMap contributors</div>
  </div>;
}

type Props = { drivers: MapDriver[]; onSelect?: (key: string) => void; focus?: [number, number] };

export default function DriverMap(props: Props) {
  return usingGoogleMaps ? <GoogleDriverMap {...props} /> : <LeafletDriverMap {...props} />;
}
