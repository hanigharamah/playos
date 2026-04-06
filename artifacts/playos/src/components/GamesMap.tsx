import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";

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

const RIYADH = { lat: 24.7136, lng: 46.6753 };
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function GamesMap({ games, onPitchClick }: GamesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Group games by pitch (only those with coordinates)
  const pitchGroups: PitchGroup[] = [];
  const seen = new Map<string, PitchGroup>();

  for (const g of games) {
    if (!g.latitude || !g.longitude) continue;
    if (g.status !== "open") continue;
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
    if (!API_KEY || !mapRef.current) return;

    const loader = new Loader({
      apiKey: API_KEY,
      version: "weekly",
      libraries: ["marker"],
    });

    loader
      .load()
      .then(() => {
        if (!mapRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
          center: RIYADH,
          zoom: 11,
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            { featureType: "all", elementType: "labels.text.fill", stylers: [{ color: "#1C1C1E" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d8e8" }] },
            { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E5E5EA" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#d0ead7" }] },
          ],
        });

        mapInstanceRef.current = map;

        // Create markers + info windows
        pitchGroups.forEach((pitch) => {
          const countLabel = pitch.gameCount > 1 ? `${pitch.gameCount} games` : "1 game";

          // Custom marker element
          const pin = document.createElement("div");
          pin.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            background: #0A84FF;
            color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
            font-size: 12px;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 999px;
            box-shadow: 0 2px 8px rgba(10,132,255,0.4);
            cursor: pointer;
            white-space: nowrap;
            border: 2px solid rgba(255,255,255,0.9);
          `;
          pin.innerHTML = `⚽ <span>${countLabel}</span>`;

          const marker = new (google.maps as any).marker.AdvancedMarkerElement({
            position: { lat: pitch.lat, lng: pitch.lng },
            map,
            content: pin,
            title: pitch.pitchName,
          });

          // Info window
          const infoHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; padding: 4px 2px; min-width: 160px;">
              <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #1D3557;">${pitch.pitchName}</p>
              ${pitch.locationText ? `<p style="margin: 0 0 6px; font-size: 11px; color: #6C6C70;">${pitch.locationText}</p>` : ""}
              <p style="margin: 0 0 8px; font-size: 11px; color: #6C6C70;">${pitch.gameCount} open game${pitch.gameCount > 1 ? "s" : ""}</p>
              <a id="view-games-${pitch.pitchName.replace(/\s+/g, "-")}"
                href="#"
                style="font-size: 12px; font-weight: 600; color: #0A84FF; text-decoration: none;">
                View Games ↓
              </a>
            </div>
          `;

          const infoWindow = new google.maps.InfoWindow({ content: infoHtml });

          marker.addListener("gmp-click", () => {
            infoWindow.open({ anchor: marker, map });
            // Listen for "View Games" click after info window opens
            google.maps.event.addListenerOnce(infoWindow, "domready", () => {
              const el = document.getElementById(
                `view-games-${pitch.pitchName.replace(/\s+/g, "-")}`
              );
              if (el) {
                el.addEventListener("click", (e) => {
                  e.preventDefault();
                  infoWindow.close();
                  onPitchClick?.(pitch.pitchName);
                });
              }
            });
          });
        });

        setIsLoaded(true);
      })
      .catch((err) => {
        console.error("Google Maps load error:", err);
        setLoadError("Map failed to load");
      });
  }, [API_KEY, pitchGroups.length]);

  // No API key — show placeholder
  if (!API_KEY) {
    return (
      <div
        className="w-full h-40 md:h-64 rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] flex flex-col items-center justify-center gap-2"
      >
        <span className="text-2xl">🗺️</span>
        <p className="text-sm font-medium text-[#6C6C70]">Map coming soon…</p>
        <p className="text-xs text-[#AEAEB2]">Add VITE_GOOGLE_MAPS_API_KEY to enable</p>
      </div>
    );
  }

  // No games have coordinates — same placeholder
  if (!hasCoords) {
    return (
      <div className="w-full h-40 md:h-64 rounded-xl border border-[#E5E5EA] bg-[#F2F2F7] flex flex-col items-center justify-center gap-2">
        <span className="text-2xl">📍</span>
        <p className="text-sm font-medium text-[#6C6C70]">Map coming soon…</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-40 md:h-64 rounded-xl overflow-hidden border border-[#E5E5EA]">
      <div ref={mapRef} className="w-full h-full" />
      {!isLoaded && (
        <div className="absolute inset-0 bg-[#F2F2F7] flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-[#0A84FF] border-t-transparent animate-spin" />
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 bg-[#F2F2F7] flex items-center justify-center">
          <p className="text-sm text-[#6C6C70]">{loadError}</p>
        </div>
      )}
    </div>
  );
}
