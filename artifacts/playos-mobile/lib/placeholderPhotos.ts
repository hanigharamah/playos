/**
 * Generic venue photos — used until real per-venue photos are uploaded via
 * pitches.photo_url (see supabase/2026-07-mobile-design-support.sql).
 * Every URL below was verified (curl 200 + visually) before landing here —
 * amateur/generic football imagery only, no professional stadiums, no
 * identifiable people, no wrong-sport photos, matching PlayOS's actual
 * product (casual local pitch bookings, not televised matches).
 */
const GENERIC_PITCH_PHOTOS = [
  "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=800&q=70",
  "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=800&q=70",
  "https://images.unsplash.com/photo-1552667466-07770ae110d0?auto=format&fit=crop&w=800&q=70",
  "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=800&q=70",
  "https://images.unsplash.com/photo-1614632537190-23e4146777db?auto=format&fit=crop&w=800&q=70",
  "https://images.unsplash.com/photo-1600679472829-3044539ce8ed?auto=format&fit=crop&w=800&q=70",
] as const;

/** Deterministic pick so the same venue always shows the same placeholder. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getVenuePhoto(pitchName: string, photoUrl?: string | null): string {
  if (photoUrl) return photoUrl;
  return GENERIC_PITCH_PHOTOS[hashString(pitchName) % GENERIC_PITCH_PHOTOS.length];
}
