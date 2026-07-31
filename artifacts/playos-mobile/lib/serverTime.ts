import { useEffect, useState } from "react";
import { AppState } from "react-native";
import Constants from "expo-constants";

/**
 * Server clock.
 *
 * The check-in window (Figma 684:542) is specified as "server clock only,
 * never the device clock" — a phone with a wrong or deliberately-set clock
 * must not be able to open check-in early or hold it open late.
 *
 * We don't need a new endpoint for this. Every HTTP response carries a `Date`
 * header stamped by the server, so one cheap request gives us the offset
 * between server time and device time. We keep that offset and apply it to
 * `Date.now()` from then on, which stays accurate as long as the device clock
 * ticks forward normally (it does — a user changing the clock mid-session is
 * the pathological case we resync for).
 */

const SUPABASE_URL = (Constants.expoConfig?.extra?.supabaseUrl as string) ?? "";

/** serverNow() - Date.now(), in ms. Zero until the first successful sync. */
let offsetMs = 0;
let synced = false;
let inFlight: Promise<void> | null = null;

/** How long a sync is trusted before we refresh it. */
const RESYNC_AFTER_MS = 10 * 60 * 1000;
let lastSyncAt = 0;

export async function syncServerTime(): Promise<void> {
  if (!SUPABASE_URL) return;
  if (inFlight) return inFlight;

  lastAttemptAt = Date.now();
  inFlight = (async () => {
    try {
      // Round-trip is halved to approximate the instant the server stamped it.
      const before = Date.now();
      const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { method: "HEAD" });
      const after = Date.now();

      const header = res.headers.get("date");
      if (!header) return;

      const serverMs = new Date(header).getTime();
      if (Number.isNaN(serverMs)) return;

      offsetMs = serverMs - (before + (after - before) / 2);
      synced = true;
      lastSyncAt = Date.now();
    } catch {
      // Offline or blocked. Callers fall back to the device clock, and
      // isServerTimeSynced() lets the UI say so rather than pretend.
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Retry cadence while we have never successfully synced. */
const RETRY_UNSYNCED_MS = 15 * 1000;
let lastAttemptAt = 0;

/** Best available "now". Equals Date.now() until the first sync lands. */
export function serverNow(): number {
  const since = Date.now() - (synced ? lastSyncAt : lastAttemptAt);
  // Previously this only retried once already synced, so a failed first sync
  // (offline at launch) meant raw device time forever with no further attempt.
  if (since > (synced ? RESYNC_AFTER_MS : RETRY_UNSYNCED_MS)) void syncServerTime();
  return Date.now() + offsetMs;
}

export function isServerTimeSynced(): boolean {
  return synced;
}

/**
 * Ticking countdown on the server clock. Returns ms remaining until `target`,
 * clamped at zero, refreshed every second.
 */
export function useServerCountdown(target: number | null): { remainingMs: number; synced: boolean } {
  const [remainingMs, setRemainingMs] = useState(() =>
    target === null ? 0 : Math.max(0, target - serverNow()),
  );
  const [syncedState, setSyncedState] = useState(isServerTimeSynced);

  useEffect(() => {
    let alive = true;
    void syncServerTime().then(() => { if (alive) setSyncedState(isServerTimeSynced()); });

    // A user can change the device clock while the app is backgrounded, so
    // re-derive the offset on every return to the foreground.
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void syncServerTime().then(() => { if (alive) setSyncedState(isServerTimeSynced()); });
    });
    return () => { alive = false; sub.remove(); };
  }, []);

  useEffect(() => {
    if (target === null) return;
    const tick = () => setRemainingMs(Math.max(0, target - serverNow()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return { remainingMs, synced: syncedState };
}

/** "14:22" for a sub-hour countdown, "1:14:22" once it passes an hour. */
export function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
