import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapGame {
  id: string;
  pitchName: string;
  locationText?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
}

interface PitchGroup {
  pitchName: string;
  locationText?: string | null;
  lat: number;
  lng: number;
  gameCount: number;
}

interface GamesMapProps {
  games: MapGame[];
  onPitchClick?: (pitchName: string) => void;
}

const RIYADH: L.LatLngTuple = [24.7136, 46.6753];
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

function buildPitchGroups(games: MapGame[]): PitchGroup[] {
  const groups: PitchGroup[] = [];
  const seen = new Map<string, PitchGroup>();
  for (const g of games) {
    const lat = Number(g.latitude);
    const lng = Number(g.longitude);
    if (!lat || !lng) continue;
    if (seen.has(g.pitchName)) {
      seen.get(g.pitchName)!.gameCount++;
    } else {
      const group: PitchGroup = {
        pitchName: g.pitchName,
        locationText: g.locationText,
        lat,
        lng,
        gameCount: 1,
      };
      seen.set(g.pitchName, group);
      groups.push(group);
    }
  }
  return groups;
}

function makeMarkerIcon(count: number): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:36px;height:36px;border-radius:50%;
        background:#0A84FF;border:3px solid #fff;
        box-shadow:0 2px 8px rgba(10,132,255,0.45);
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:13px;font-weight:800;
        font-family:-apple-system,BlinkMacSystemFont,sans-serif;
        cursor:pointer;
      ">${count}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
  });
}

export function GamesMap({ games, onPitchClick }: GamesMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const onPitchClickRef = useRef(onPitchClick);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  onPitchClickRef.current = onPitchClick;

  // No token — placeholder
  if (!TOKEN) {
    return (
      <div className="w-full h-40 md:h-64 rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] flex flex-col items-center justify-center gap-2">
        <span className="text-2xl">🗺️</span>
        <p className="text-sm font-medium text-[#6C6C70]">Map coming soon…</p>
      </div>
    );
  }

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    try {
      const map = L.map(mapContainerRef.current, {
        center: RIYADH,
        zoom: 11,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${TOKEN}`,
        {
          tileSize: 512,
          zoomOffset: -1,
          attribution:
            '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          crossOrigin: true,
        }
      ).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    } catch (e) {
      console.error("Leaflet init error:", e);
      setLoadError(true);
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Sync markers whenever games change OR map becomes ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const pitchGroups = buildPitchGroups(games);
    pitchGroups.forEach((pitch) => {
      const popupHtml = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;min-width:150px;">
          <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#1D3557;">${pitch.pitchName}</p>
          ${pitch.locationText ? `<p style="margin:0 0 4px;font-size:11px;color:#6C6C70;">${pitch.locationText}</p>` : ""}
          <p style="margin:0 0 8px;font-size:11px;color:#6C6C70;">${pitch.gameCount} open game${pitch.gameCount !== 1 ? "s" : ""}</p>
          <a class="lf-view-games" data-pitch="${pitch.pitchName}" href="#"
            style="font-size:12px;font-weight:600;color:#0A84FF;text-decoration:none;">View Games ↓</a>
        </div>
      `;

      const marker = L.marker([pitch.lat, pitch.lng], {
        icon: makeMarkerIcon(pitch.gameCount),
      })
        .addTo(map)
        .bindPopup(popupHtml, { offset: [0, -6] });

      marker.on("popupopen", () => {
        setTimeout(() => {
          document.querySelectorAll<HTMLAnchorElement>(".lf-view-games").forEach((link) => {
            link.addEventListener("click", (e) => {
              e.preventDefault();
              marker.closePopup();
              onPitchClickRef.current?.(link.dataset.pitch ?? "");
            });
          });
        }, 50);
      });

      markersRef.current.push(marker);
    });
  }, [games, mapReady]);

  if (loadError) {
    return (
      <div className="w-full h-40 md:h-64 rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] flex flex-col items-center justify-center gap-2">
        <span className="text-2xl">🗺️</span>
        <p className="text-sm font-medium text-[#6C6C70]">Map couldn't load</p>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-40 md:h-64 rounded-xl overflow-hidden border border-[#E5E5EA]"
    />
  );
}
