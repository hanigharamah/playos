// Survives the create-game form across a tab reload — whether that reload is
// caused by an auth blip, or the browser genuinely discarding a backgrounded
// tab under memory pressure (Chrome does this, and a heavy tab like Google
// Maps open alongside is exactly the kind of thing that triggers it). Session
// storage is the right tool here: it's untouched by React remounts and is
// preserved across a reload of the same tab, but doesn't linger once the tab
// is actually closed.

const DRAFT_KEY = "playos_create_game_draft";
const MAX_AGE_MS = 30 * 60 * 1000; // stale after 30 min — don't resurrect an old draft

export interface CreateGameDraft {
  date: string;
  startTime: string;
  endTime: string;
  pitchName: string;
  isPublic: boolean;
  capacity: number;
  price: number;
  autoCancelHours: number;
  mapsUrl: string;
  coords: string;
  savedAt: number;
}

export function saveCreateGameDraft(draft: Omit<CreateGameDraft, "savedAt">): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // Storage unavailable (private mode, quota) — draft just won't survive a reload.
  }
}

export function loadCreateGameDraft(): CreateGameDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CreateGameDraft;
    if (Date.now() - draft.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearCreateGameDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clean up if storage isn't available.
  }
}
