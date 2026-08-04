import { useEffect, useState } from "react";
import * as Location from "expo-location";

/**
 * Where the player is, and how far that is from a venue.
 *
 * Browse says "N pitches near you" and lists nearest-first. Two things have to
 * be true for that to mean anything, and either can be absent:
 *
 *   1. the player granted location, and a fix came back;
 *   2. the venue has coordinates the operator typed in.
 *
 * Neither is guaranteed, so nothing here throws or blocks. `useMyLocation`
 * returns null until it has a real fix and stays null if permission is
 * refused; `sortByDistance` falls back to the previous ordering. The screen
 * degrades to what it was rather than to an error or a fake number.
 */

export type Coords = { lat: number; lng: number };

/** Metres per degree of latitude, and the earth radius the haversine uses. */
const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance in kilometres.
 *
 * Haversine rather than the cheaper equirectangular approximation: the cost is
 * irrelevant for four venues, and equirectangular drifts at high latitude for
 * no benefit. Riyadh is at 24°N where both are fine, but the function should
 * not quietly stop being right if the app ever leaves the city.
 */
export function distanceKm(a: Coords, b: Coords): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * "2.1 km away", or "700 m away" under a kilometre.
 *
 * Switching units below 1 km matters here: every venue in a single city is
 * within a few kilometres, so "0.7 km" would be the common case and reads as
 * less precise than it is.
 */
export function distanceLabel(km: number): string {
  if (km < 1) return `${Math.round(km * 1000 / 50) * 50} m away`;
  return `${km.toFixed(1)} km away`;
}

/**
 * The player's coordinates, or null.
 *
 * Deliberately does NOT request permission on mount. A permission sheet that
 * appears the first time someone opens Browse, before they know what the app
 * does with it, is the classic way to get a permanent denial — and a denial is
 * permanent, since iOS will not ask twice. `request()` is exposed so the
 * locate button can ask at the moment the player has asked for exactly this.
 *
 * On mount it only reads permission that was ALREADY granted, which is silent.
 */
export function useMyLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<"unknown" | "granted" | "denied">("unknown");

  async function read() {
    // getLastKnownPositionAsync first: it returns immediately from the OS
    // cache, so the list sorts on the frame the screen opens rather than
    // reshuffling under the player's thumb a second later. The precise fix
    // then refines it if it differs.
    const last = await Location.getLastKnownPositionAsync();
    if (last) setCoords({ lat: last.coords.latitude, lng: last.coords.longitude });

    const now = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced, // ~100m: far finer than needed to rank venues km apart
    });
    setCoords({ lat: now.coords.latitude, lng: now.coords.longitude });
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      const { status: s } = await Location.getForegroundPermissionsAsync();
      if (!alive) return;
      if (s !== "granted") {
        setStatus(s === "denied" ? "denied" : "unknown");
        return;
      }
      setStatus("granted");
      try {
        await read();
      } catch {
        // A granted permission with no fix — airplane mode, indoors, a
        // simulator with no location set. Not an error state for the player:
        // the list just keeps its fallback order.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Ask for permission, then read. Call from an explicit user action only. */
  async function request() {
    const { status: s } = await Location.requestForegroundPermissionsAsync();
    setStatus(s === "granted" ? "granted" : "denied");
    if (s !== "granted") return false;
    try {
      await read();
      return true;
    } catch {
      return false;
    }
  }

  return { coords, status, request };
}

/**
 * Sort venues nearest-first, keeping the ones without coordinates.
 *
 * A venue the operator has not located yet still has real open games, so
 * dropping it would hide bookable football. It sorts after everything with a
 * distance, in the fallback order — which is why `fallbackCompare` is passed
 * in rather than assumed.
 */
export function sortByDistance<T>(
  items: T[],
  me: Coords | null,
  coordsOf: (item: T) => Coords | null,
  fallbackCompare: (a: T, b: T) => number,
): T[] {
  if (!me) return [...items].sort(fallbackCompare);

  return [...items].sort((a, b) => {
    const ca = coordsOf(a);
    const cb = coordsOf(b);
    if (ca && cb) return distanceKm(me, ca) - distanceKm(me, cb);
    if (ca) return -1;
    if (cb) return 1;
    return fallbackCompare(a, b);
  });
}
