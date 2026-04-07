import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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

const RIYADH: [number, number] = [46.6753, 24.7136];
const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export function GamesMap({ games, onPitchClick }: GamesMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [loadError, setLoadError] = useState(false);

  // Group games by pitch — only open games with coordinates
  const pitchGroups: PitchGroup[] = [];
  const seen = new Map<string, PitchGroup>();
  for (const g of games) {
    if (!g.latitude || !g.longitude || g.status !== "open") continue;
    const key = g.pitchName;
    if (seen.has(key)) {
      seen.get(key)!.gameCount++;
    } else {
      const group: PitchGroup = {
        pitchName: g.pitchName,
        locationText: g.locationText,
        lat: g.latitude,
        lng: g.longitude,
        gameCount: 1,
      };
      seen.set(key, group);
      pitchGroups.push(group);
    }
  }

  const hasCoords = pitchGroups.length > 0;

  useEffect(() => {
    if (!TOKEN || !mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = TOKEN;

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: RIYADH,
        zoom: 11,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

      mapRef.current = map;

      map.on("load", () => {
        // Clear old markers
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        pitchGroups.forEach((pitch) => {
          // Custom marker element — blue circle with game count
          const el = document.createElement("div");
          el.style.cssText = `
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: #0A84FF;
            border: 3px solid #fff;
            box-shadow: 0 2px 8px rgba(10,132,255,0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 13px;
            font-weight: 800;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            cursor: pointer;
            transition: transform 0.15s ease;
          `;
          el.textContent = String(pitch.gameCount);
          el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.15)"; });
          el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

          // Popup
          const popupHtml = `
            <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:2px 0;min-width:160px;">
              <p style="margin:0 0 3px;font-size:13px;font-weight:700;color:#1D3557;">${pitch.pitchName}</p>
              ${pitch.locationText ? `<p style="margin:0 0 5px;font-size:11px;color:#6C6C70;">${pitch.locationText}</p>` : ""}
              <p style="margin:0 0 8px;font-size:11px;color:#6C6C70;">${pitch.gameCount} open game${pitch.gameCount !== 1 ? "s" : ""}</p>
              <a class="mapbox-view-games" data-pitch="${pitch.pitchName}" href="#"
                style="font-size:12px;font-weight:600;color:#0A84FF;text-decoration:none;">
                View Games ↓
              </a>
            </div>
          `;

          const popup = new mapboxgl.Popup({ offset: 22, closeButton: true, maxWidth: "220px" })
            .setHTML(popupHtml);

          popup.on("open", () => {
            setTimeout(() => {
              document.querySelectorAll<HTMLAnchorElement>(".mapbox-view-games").forEach((link) => {
                link.addEventListener("click", (e) => {
                  e.preventDefault();
                  popup.remove();
                  onPitchClick?.(link.dataset.pitch ?? "");
                });
              });
            }, 50);
          });

          const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([pitch.lng, pitch.lat])
            .setPopup(popup)
            .addTo(map);

          markersRef.current.push(marker);
        });
      });

      map.on("error", () => setLoadError(true));
    } catch {
      setLoadError(true);
    }

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [TOKEN]);

  // No token or load error — fallback placeholder
  if (!TOKEN || loadError) {
    return (
      <div className="w-full h-40 md:h-64 rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] flex flex-col items-center justify-center gap-2">
        <span className="text-2xl">🗺️</span>
        <p className="text-sm font-medium text-[#6C6C70]">Map coming soon…</p>
      </div>
    );
  }

  // No open games with coordinates — show placeholder
  if (!hasCoords) {
    return (
      <div className="w-full h-40 md:h-64 rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] flex flex-col items-center justify-center gap-2">
        <span className="text-2xl">📍</span>
        <p className="text-sm font-medium text-[#6C6C70]">No pitch locations on map yet</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-40 md:h-64 rounded-xl overflow-hidden border border-[#E5E5EA]">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
}
