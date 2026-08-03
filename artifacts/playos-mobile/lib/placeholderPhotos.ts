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

/**
 * Per-venue district imagery. NONE of these are photos of the pitch itself —
 * they are recognisable landmarks in the venue's own district, standing in
 * until a real photo lands in pitches.photo_url. Every URL was curl'd (200)
 * and looked at before landing here, and every licence permits commercial use
 * with no attribution requirement.
 *
 * Keys are NORMALISED (see normaliseVenueName): games.pitch_name holds dirty
 * variants of the same venue — "Al Rowad", "Al Rowad " with a trailing space,
 * and "ALROWAD PITCH" are all one place.
 *
 * Two venues are deliberately absent. "Arena Riyadh" (Al Nakheel) and "King
 * Fahd Arena" (Hittin) have no freely-licensed district photo that is both
 * honest and legible at thumbnail size, so they fall through to a generic
 * pitch — which is the right answer. A generic pitch beats a photo of
 * somewhere else, and King Fahd Arena is a local five-a-side venue, NOT King
 * Fahd International Stadium: stadium imagery would misrepresent what the
 * player is booking.
 */
const VENUE_PHOTOS: Record<string, string> = {
  // Zaha Hadid's KAFD Metro Station and the KAFD tower cluster.
  // Unsplash Licence — unsplash.com/photos/...-XplX5vASmkM, tagged KAFD, Riyadh.
  "kafd pitch":
    "https://images.unsplash.com/photo-1780657403478-af4a182c6ce4?auto=format&fit=crop&w=800&q=70",

  // Al Faisaliah Tower with the King Fahd National Library façade — both in
  // Al Olaya. Unsplash Licence — unsplash.com/photos/...-kZ5nwgLVjqQ.
  "al rowad":
    "https://images.unsplash.com/photo-1784637729389-f24e1d2a8b22?auto=format&fit=crop&w=800&q=70",
  "al rowad 8 a side":
    "https://images.unsplash.com/photo-1784637729389-f24e1d2a8b22?auto=format&fit=crop&w=800&q=70",
  "alrowad pitch":
    "https://images.unsplash.com/photo-1784637729389-f24e1d2a8b22?auto=format&fit=crop&w=800&q=70",
};

/** Lowercase, trimmed, whitespace collapsed — pitch names in the DB are dirty. */
function normaliseVenueName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Deterministic pick so the same venue always shows the same placeholder. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getVenuePhoto(pitchName: string, photoUrl?: string | null): string {
  if (photoUrl) return photoUrl;
  const key = normaliseVenueName(pitchName);
  const mapped = VENUE_PHOTOS[key];
  if (mapped) return mapped;
  // Hash the NORMALISED key, not the raw name: "Al Rowad" and "Al Rowad " are
  // the same venue and were being given two different generic photos in the
  // same list, which read as two different places.
  return GENERIC_PITCH_PHOTOS[hashString(key) % GENERIC_PITCH_PHOTOS.length];
}
