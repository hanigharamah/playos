/**
 * Data layer — mirrors ../playos/src/lib/supabase-api.ts. Same Supabase
 * project, same tables, same RLS. Hook names and shapes match the web app
 * wherever practical so logic (occupancy math, refund tiers, slot
 * assignment) isn't re-derived, it's ported.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { serverNow, syncServerTime } from "./serverTime";

// ─── Types ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  role: "player" | "operator" | "host" | "admin";
  createdAt: string;
}

export interface GameSummary {
  id: string;
  title: string;
  pitchName: string;
  pitchPhotoUrl: string | null;
  locationText: string | null;
  kickoffTime: string;
  price: number;
  capacity: number;
  status: string;
  bookedCount: number;
  durationMinutes: number;
  isPublic: boolean;
  mapsUrl: string | null;
}

export interface GameDetail extends GameSummary {
  bookings: BookingRow[];
}

export interface BookingRow {
  id: string;
  gameId: string;
  userId: string | null;
  team: number;
  slotIndex: number;
  paymentStatus: "pending" | "paid" | "refunded" | "forfeited";
  paymentMethod?: "cash" | "stcpay" | null;
  bookedAt: string;
}

export interface MyBooking {
  id: string;
  gameId: string;
  team: number;
  slotIndex: number;
  paymentStatus: string;
  bookedAt: string;
  game: {
    id: string;
    title: string;
    pitchName: string;
    pitchPhotoUrl: string | null;
    kickoffTime: string;
    price: number;
    capacity: number;
    status: string;
  };
}

export interface AppSettings {
  whatsappUrl: string;
  stcpayNumber: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  whatsappUrl: "https://chat.whatsapp.com/",
  stcpayNumber: "05XXXXXXXX",
};

// ─── Helpers ────────────────────────────────────────────────────────────

function uid(): string {
  // RN has no global crypto.randomUUID on older engines; expo-crypto is the
  // safe cross-platform choice. Add `expo-crypto` to deps if not present.
  // Fallback keeps this file usable even before that dep lands.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Crypto = require("expo-crypto");
    return Crypto.randomUUID();
  } catch {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("966")) return `+${digits}`;
  if (digits.startsWith("05")) return `+966${digits.slice(1)}`;
  return `+966${digits}`;
}

function mapGameSummary(g: Record<string, any>, bookedCount?: number, photoUrl?: string | null): GameSummary {
  return {
    id: g.id,
    title: g.title,
    pitchName: g.pitch_name,
    pitchPhotoUrl: photoUrl ?? null,
    locationText: g.location_text ?? null,
    kickoffTime: g.kickoff_time,
    price: Number(g.price),
    capacity: g.capacity,
    status: g.status,
    bookedCount:
      bookedCount ?? (g.bookings as any[] | undefined)?.filter((b) => b.payment_status === "paid").length ?? 0,
    durationMinutes: g.duration_minutes,
    isPublic: g.is_public,
    mapsUrl: g.maps_url ?? null,
  };
}

/**
 * games.pitch_name is a denormalized text copy (not a foreign key), so
 * pitch photos are looked up by name match — matches the existing
 * architecture rather than introducing a new FK relationship.
 */
async function fetchPitchPhotos(pitchNames: string[]): Promise<Map<string, string | null>> {
  const unique = Array.from(new Set(pitchNames));
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase.from("pitches").select("name, photo_url").in("name", unique);
  if (error || !data) return new Map();
  return new Map(data.map((p: any) => [p.name, p.photo_url ?? null]));
}

// ─── Query keys ─────────────────────────────────────────────────────────

export const qk = {
  me: ["me"] as const,
  games: (params?: { city?: string }) => ["games", params] as const,
  game: (id: string) => ["game", id] as const,
  myBookings: ["my-bookings"] as const,
  myCredits: ["my-credits"] as const,
  settings: ["settings"] as const,
};

// ─── Auth ───────────────────────────────────────────────────────────────

export function useGetMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async (): Promise<AuthUser | null> => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return null;
      const { data } = await supabase.from("users").select("*").eq("id", user.id).single();
      if (!data) return null;
      return {
        id: data.id, email: data.email, phone: data.phone,
        name: data.name, role: data.role, createdAt: data.created_at,
      };
    },
    retry: false,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { email: string; password: string }): Promise<AuthUser> => {
      const { data: auth, error } = await supabase.auth.signInWithPassword({
        email: vars.email,
        password: vars.password,
      });
      if (error) throw { data: { error: error.message } };

      const { data: profile } = await supabase.from("users").select("*").eq("id", auth.user.id).single();
      if (!profile) throw { data: { error: "Profile not found" } };

      const user: AuthUser = {
        id: profile.id, email: profile.email, phone: profile.phone,
        name: profile.name, role: profile.role, createdAt: profile.created_at,
      };
      queryClient.setQueryData(qk.me, user);
      return user;
    },
  });
}

export function useSignUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      email: string; password: string; phone: string; name: string;
    }): Promise<AuthUser> => {
      const { data: auth, error } = await supabase.auth.signUp({
        email: vars.email,
        password: vars.password,
        options: { data: { name: vars.name, role: "player" } },
      });
      if (error) throw { data: { error: error.message } };
      if (!auth.user) throw { data: { error: "Signup failed" } };

      await supabase.from("users").update({ phone: normalizePhone(vars.phone) }).eq("id", auth.user.id);

      const { data: profile } = await supabase.from("users").select("*").eq("id", auth.user.id).single();
      if (!profile) throw { data: { error: "Profile creation failed" } };

      const user: AuthUser = {
        id: profile.id, email: profile.email, phone: profile.phone,
        name: profile.name, role: profile.role, createdAt: profile.created_at,
      };
      queryClient.setQueryData(qk.me, user);
      return user;
    },
  });
}

// ─── Games ──────────────────────────────────────────────────────────────

async function fetchPublicGameCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("get_public_game_counts");
  if (error || !data) return new Map();
  return new Map(data.map((r: any) => [r.game_id, r.booked_count]));
}

export function useListGames(params?: { city?: string }) {
  return useQuery({
    queryKey: qk.games(params),
    queryFn: async (): Promise<GameSummary[]> => {
      const [{ data, error }, counts] = await Promise.all([
        supabase
          .from("games")
          .select("*, bookings(id, payment_status)")
          .eq("is_public", true)
          .neq("status", "cancelled")
          .gte("kickoff_time", new Date().toISOString())
          .order("kickoff_time", { ascending: true }),
        fetchPublicGameCounts(),
      ]);
      if (error) throw error;
      const rows = data ?? [];
      const photos = await fetchPitchPhotos(rows.map((g) => g.pitch_name));
      return rows.map((g) => mapGameSummary(g, counts.get(g.id), photos.get(g.pitch_name)));
    },
  });
}

export function useGetGame(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: qk.game(id),
    enabled: options?.enabled ?? !!id,
    queryFn: async (): Promise<GameDetail> => {
      const { data: game, error } = await supabase
        .from("games")
        .select("*, bookings(id, game_id, user_id, team, slot_index, payment_status, payment_method, booked_at)")
        .eq("id", id)
        .single();
      if (error || !game) throw { data: { error: "Game not found" } };

      const bookings: BookingRow[] = (game.bookings as any[]).map((b) => ({
        id: b.id, gameId: b.game_id, userId: b.user_id, team: b.team,
        slotIndex: b.slot_index, paymentStatus: b.payment_status,
        paymentMethod: b.payment_method, bookedAt: b.booked_at,
      }));

      const photos = await fetchPitchPhotos([game.pitch_name]);
      return {
        ...mapGameSummary(game, bookings.filter((b) => b.paymentStatus === "paid").length, photos.get(game.pitch_name)),
        bookings,
      };
    },
  });
}

/**
 * Books a slot and returns a bookingId to navigate into checkout with.
 * Slot-assignment logic is a direct port of the web's useBookSpot —
 * do not simplify the fallback-slot search, it exists to handle races.
 */
export function useBookSpot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { gameId: string; team: number; slotIndex: number }): Promise<{ bookingId: string }> => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw { data: { error: "Not authenticated" } };

      const { data: game, error: gameErr } = await supabase
        .from("games")
        .select("*, bookings(team, slot_index, payment_status, user_id)")
        .eq("id", vars.gameId)
        .single();
      if (gameErr || !game) throw { data: { error: "Game not found" } };
      if (game.status === "cancelled") throw { data: { error: "Game is cancelled" } };
      if (game.status === "full") throw { data: { error: "Game is full" } };

      // A spot is occupied the moment it's booked, not when it's marked paid.
      // Filtering to "paid" here made every guard below dead code: the app only
      // ever inserts "pending", so the same user could book a game repeatedly
      // and two users could land on one slot. This matches PitchSVG, which
      // already treated any non-refunded booking as occupied.
      const activeBookings = (game.bookings as any[]).filter(
        (b) => b.payment_status !== "refunded" && b.payment_status !== "forfeited",
      );
      if (activeBookings.some((b) => b.user_id === user.id)) {
        throw { data: { error: "You already have a spot in this game" } };
      }

      if (!game.kickoff_time || new Date(game.kickoff_time).getTime() <= Date.now()) {
        throw { data: { error: "This match has already kicked off" } };
      }

      // Floor: an odd capacity would otherwise yield a fractional bound and let
      // the loops below hand out one slot per team more than the game holds.
      const slotsPerTeam = Math.floor(game.capacity / 2);
      if (slotsPerTeam < 1) throw { data: { error: "This match has no open slots" } };
      if (activeBookings.length >= game.capacity) throw { data: { error: "Game is full" } };
      let assignedTeam = vars.team;
      let assignedSlot = vars.slotIndex;

      const slotTaken = activeBookings.some((b) => b.team === assignedTeam && b.slot_index === assignedSlot);
      if (slotTaken) {
        const used = new Set(activeBookings.filter((b) => b.team === assignedTeam).map((b) => b.slot_index));
        let found = false;
        for (let s = 0; s < slotsPerTeam; s++) {
          if (!used.has(s)) { assignedSlot = s; found = true; break; }
        }
        if (!found) {
          const other = assignedTeam === 1 ? 2 : 1;
          const otherUsed = new Set(activeBookings.filter((b) => b.team === other).map((b) => b.slot_index));
          for (let s = 0; s < slotsPerTeam; s++) {
            if (!otherUsed.has(s)) { assignedTeam = other; assignedSlot = s; found = true; break; }
          }
          if (!found) throw { data: { error: "No spots available" } };
        }
      }

      const bookingId = uid();
      const { error: insErr } = await supabase.from("bookings").insert({
        id: bookingId, game_id: vars.gameId, user_id: user.id,
        team: assignedTeam, slot_index: assignedSlot, payment_status: "pending",
      });
      if (insErr) {
        // 23505 = unique violation. Once 2026-07-booking-integrity.sql is
        // applied this is how a genuine race loses: two devices both passed
        // the client-side check above and the database rejected the second.
        if ((insErr as any).code === "23505") {
          throw { data: { error: "Someone just took that spot — pick another." } };
        }
        throw insErr;
      }

      queryClient.invalidateQueries({ queryKey: qk.game(vars.gameId) });
      queryClient.invalidateQueries({ queryKey: qk.games() });
      queryClient.invalidateQueries({ queryKey: qk.myBookings });
      return { bookingId };
    },
  });
}

export function useConfirmPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { bookingId: string; method: "cash" | "stcpay" }) => {
      const { error } = await supabase
        .from("bookings").update({ payment_method: vars.method }).eq("id", vars.bookingId);
      if (error) throw { data: { error: "Something went wrong — please try again." } };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.myBookings }),
  });
}

/**
 * The one place the cancellation cutoff is defined. Callers must import this
 * rather than repeating the number — it was previously hardcoded in five
 * places across two codebases.
 */
export const FREE_CANCEL_HOURS = 26;

/**
 * Auto-start floor at T+15. Distinct from AUTO_CANCEL_MIN_CHECKED_IN in
 * lib/refunds.ts, which is the T-10 auto-cancel threshold (10 of 12) — they
 * are different rules at different moments, not a duplicated constant.
 */
export const MIN_PLAYERS_TO_START = 6;

/**
 * Flat 26h policy (July 2026): > 26h → full refund, otherwise nothing.
 * Mirrors the web's useCancelBooking; keep both in sync with the policy page.
 * Resale-triggered token issuance is deliberately not implemented — it depends
 * on a waitlist/reclaim claim-and-pay flow that doesn't exist yet.
 */
export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { bookingId: string }): Promise<{ message: string }> => {
      const { data: booking, error: readErr } = await supabase
        .from("bookings").select("game_id, user_id, games(kickoff_time)").eq("id", vars.bookingId).single();

      // Refund eligibility must be decided BEFORE anything is written. This
      // previously flipped the row to "refunded" first and only used the
      // eligibility check to pick the message, so a cancellation inside 26h
      // told the player "no refund" while recording a refund in the database.
      const kickoff = (booking?.games as any)?.kickoff_time;
      if (readErr || !booking || !kickoff) {
        // Falling back to 0 hours here would silently deny a refund the player
        // was entitled to. Refuse instead of guessing.
        throw { data: { error: "Couldn't load this booking — please try again." } };
      }

      // Server clock, not the device clock: this decides money, so a phone with
      // a wound-back clock must not be able to buy itself a refund.
      await syncServerTime();
      const hoursUntil = (new Date(kickoff).getTime() - serverNow()) / 3_600_000;
      const eligible = hoursUntil > FREE_CANCEL_HOURS;

      // A cancellation inside the cutoff releases the spot but keeps the
      // money, so it must not be written as a refund. 'forfeited' is the
      // terminal state added by 2026-07-booking-integrity.sql.
      const terminal = eligible ? "refunded" : "forfeited";
      const { error } = await supabase.from("bookings").update({ payment_status: terminal }).eq("id", vars.bookingId);
      if (error) throw error;

      const message = eligible
        ? "Booking cancelled. You'll receive a full refund."
        : `Booking cancelled. No refund applies ${FREE_CANCEL_HOURS} hours or less before kickoff.`;

      if (booking?.game_id) {
        await supabase.from("games").update({ status: "open" }).eq("id", booking.game_id).eq("status", "full");
        queryClient.invalidateQueries({ queryKey: qk.game(booking.game_id) });
      }
      queryClient.invalidateQueries({ queryKey: qk.myBookings });
      return { message };
    },
  });
}

/** Wallet token balance shown on the Profile screen. */
export function useGetMyCredits() {
  return useQuery({
    queryKey: qk.myCredits,
    queryFn: async (): Promise<number> => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return 0;
      const { data } = await supabase.from("users").select("credits").eq("id", uid).single();
      return data?.credits ?? 0;
    },
  });
}

export function useGetMyBookings() {
  return useQuery({
    queryKey: qk.myBookings,
    queryFn: async (): Promise<{ upcoming: MyBooking[]; past: MyBooking[] }> => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return { upcoming: [], past: [] };

      const { data, error } = await supabase
        .from("bookings")
        .select("*, games(id, title, pitch_name, kickoff_time, price, capacity, status)")
        .eq("user_id", user.id)
        .in("payment_status", ["paid", "pending"])
        .order("booked_at", { ascending: false });
      if (error) throw error;

      // A booking whose game row is missing (deleted, or hidden by RLS) used to
      // throw here on `g.id`, failing the whole query — which made Home render
      // "nothing booked yet" to a player who had bookings. Skip the orphan
      // instead of losing every other booking with it.
      const rows = (data ?? []).filter((b: any) => b.games && b.games.kickoff_time);
      const photos = await fetchPitchPhotos(rows.map((b: any) => b.games?.pitch_name).filter(Boolean));

      const now = new Date();
      const upcoming: MyBooking[] = [];
      const past: MyBooking[] = [];

      for (const b of rows) {
        const g = b.games as any;
        const item: MyBooking = {
          id: b.id, gameId: b.game_id, team: b.team, slotIndex: b.slot_index,
          paymentStatus: b.payment_status, bookedAt: b.booked_at,
          game: {
            id: g.id, title: g.title, pitchName: g.pitch_name,
            pitchPhotoUrl: photos.get(g.pitch_name) ?? null,
            kickoffTime: g.kickoff_time, price: Number(g.price),
            capacity: g.capacity, status: g.status,
          },
        };
        (new Date(g.kickoff_time) > now ? upcoming : past).push(item);
      }

      // The query orders by booked_at so the newest booking lands first, but
      // every consumer means "the match happening soonest" by upcoming[0] —
      // Home's hero, its headline, and the my-games cancel nudge all read it
      // that way. Sort by kickoff here rather than in each caller.
      upcoming.sort((a, b) => +new Date(a.game.kickoffTime) - +new Date(b.game.kickoffTime));
      past.sort((a, b) => +new Date(b.game.kickoffTime) - +new Date(a.game.kickoffTime));

      return { upcoming, past };
    },
  });
}

// ─── Settings ───────────────────────────────────────────────────────────

export function useGetSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: async (): Promise<AppSettings> => {
      try {
        const { data } = await supabase.from("app_settings").select("*").eq("id", 1).single();
        return {
          whatsappUrl: data?.whatsapp_url ?? DEFAULT_SETTINGS.whatsappUrl,
          stcpayNumber: data?.stcpay_number ?? DEFAULT_SETTINGS.stcpayNumber,
        };
      } catch {
        return DEFAULT_SETTINGS;
      }
    },
    staleTime: 60_000,
  });
}

// ─── Match day: roster, check-in, side-claiming, start ─────────────────
// Mirrors ../playos/src/lib/supabase-api.ts's flashcard section exactly.
// Check-in itself happens by scanning a pitch QR code (see the web's
// /checkin/[pitchId] page + `check_in_by_pitch` RPC) — out of scope for a
// remote app screen, so the mobile match screen assumes check-in already
// happened and focuses on side-claiming + start.

export interface RosterEntry {
  bookingId: string;
  name: string;
  team: 1 | 2 | null;
  checkedIn: boolean;
}

export interface GameRoster {
  entries: RosterEntry[];
  checkedInCount: number;
  capacity: number;
  yellowCount: number;
  purpleCount: number;
  kickoffTeam: 1 | 2 | null;
  teamsLockedAt: string | null;
}

const getGameRosterQueryKey = (gameId: string) => ["game-roster", gameId] as const;

// Multiple MatchCards can render for the same game at once (e.g. a game
// featured on Home while also listed on Play — tab navigation keeps both
// mounted), so channels are shared/ref-counted per gameId. Creating a second
// `roster:${gameId}` channel and calling `.on()` on it after another
// instance already `.subscribe()`d it throws — reusing the same channel
// object avoids that.
const rosterChannels = new Map<string, { channel: ReturnType<typeof supabase.channel>; refCount: number }>();

/** Realtime roster — subscribes to booking/game changes so all players see the same state live. */
export function useGameRoster(gameId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!gameId) return;
    let entry = rosterChannels.get(gameId);
    if (!entry) {
      const channel = supabase
        .channel(`roster:${gameId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `game_id=eq.${gameId}` }, () => {
          queryClient.invalidateQueries({ queryKey: getGameRosterQueryKey(gameId) });
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => {
          queryClient.invalidateQueries({ queryKey: getGameRosterQueryKey(gameId) });
        })
        .subscribe();
      entry = { channel, refCount: 0 };
      rosterChannels.set(gameId, entry);
    }
    entry.refCount += 1;
    return () => {
      const e = rosterChannels.get(gameId);
      if (!e) return;
      e.refCount -= 1;
      if (e.refCount <= 0) {
        supabase.removeChannel(e.channel);
        rosterChannels.delete(gameId);
      }
    };
  }, [gameId, queryClient]);

  return useQuery({
    queryKey: getGameRosterQueryKey(gameId ?? ""),
    enabled: !!gameId,
    refetchInterval: 10_000,
    queryFn: async (): Promise<GameRoster> => {
      const [{ data: gameRow }, { data: rosterRows, error: rosterErr }] = await Promise.all([
        supabase.from("games").select("capacity, kickoff_team, teams_locked_at").eq("id", gameId!).single(),
        supabase.rpc("get_game_roster", { p_game_id: gameId! }),
      ]);
      if (rosterErr) throw rosterErr;

      const capacity = gameRow?.capacity ?? 12;
      const entries: RosterEntry[] = (rosterRows ?? []).map((r: any) => ({
        bookingId: r.booking_id, name: r.name ?? "Player",
        team: (r.team as 1 | 2 | null) ?? null, checkedIn: r.checked_in ?? false,
      }));
      const checkedIn = entries.filter((e) => e.checkedIn);
      return {
        entries, checkedInCount: checkedIn.length, capacity,
        yellowCount: entries.filter((e) => e.team === 1).length,
        purpleCount: entries.filter((e) => e.team === 2).length,
        kickoffTeam: (gameRow?.kickoff_team as 1 | 2 | null) ?? null,
        teamsLockedAt: gameRow?.teams_locked_at ?? null,
      };
    },
  });
}

export type ClaimSideResult = "ok" | "full" | "already_picked" | "not_checked_in";

/** Atomic, race-safe side-claim via RPC — never assign a side client-side. */
export function useClaimSide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { gameId: string; team: 1 | 2 }): Promise<ClaimSideResult> => {
      const { data, error } = await supabase.rpc("claim_side", { p_game_id: vars.gameId, p_team: vars.team });
      if (error) throw error;
      return data as ClaimSideResult;
    },
    // Realtime is the usual path, but match day is exactly when it drops.
    onSuccess: (_r, vars) => queryClient.invalidateQueries({ queryKey: getGameRosterQueryKey(vars.gameId) }),
  });
}

export type StartMatchResult = "ok" | "already_locked" | "not_found" | "too_few";

/** Balances unpicked players/guests, locks teams, coin-flips kickoff side. */
export function useStartMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { gameId: string }): Promise<StartMatchResult> => {
      const { data, error } = await supabase.rpc("start_match", { p_game_id: vars.gameId });
      if (error) throw error;
      return data as StartMatchResult;
    },
    onSuccess: (_r, vars) => queryClient.invalidateQueries({ queryKey: getGameRosterQueryKey(vars.gameId) }),
  });
}

// ─── Profile stats (powered by get_my_stats(), see the SQL migration) ──

export interface MyStats {
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
}

export function useGetMyStats() {
  return useQuery({
    queryKey: ["my-stats"],
    queryFn: async (): Promise<MyStats> => {
      const { data, error } = await supabase.rpc("get_my_stats");
      if (error || !data?.[0]) return { gamesPlayed: 0, gamesWon: 0, winRate: 0 };
      const row = data[0];
      return { gamesPlayed: row.games_played, gamesWon: row.games_won, winRate: Number(row.win_rate) };
    },
  });
}

// ─── Activity: XP/level/streak (powered by get_my_activity(), see the ──
// 2026-07-activity-and-stats.sql migration — all computed live from real
// check-in history, nothing stored/mutable that could drift out of sync.

export interface MyActivity {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreakDays: number;
  longestStreakDays: number;
  matchesThisWeek: number;
  weekDaysPlayed: boolean[]; // Mon..Sun
}

export function useGetMyActivity() {
  return useQuery({
    queryKey: ["my-activity"],
    queryFn: async (): Promise<MyActivity> => {
      const { data, error } = await supabase.rpc("get_my_activity");
      const empty: MyActivity = {
        xp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: 250,
        currentStreakDays: 0, longestStreakDays: 0, matchesThisWeek: 0,
        weekDaysPlayed: [false, false, false, false, false, false, false],
      };
      if (error || !data?.[0]) return empty;
      const row = data[0];
      return {
        xp: row.xp, level: row.level, xpIntoLevel: row.xp_into_level, xpForNextLevel: row.xp_for_next_level,
        currentStreakDays: row.current_streak_days, longestStreakDays: row.longest_streak_days,
        matchesThisWeek: row.matches_this_week, weekDaysPlayed: row.week_days_played ?? empty.weekDaysPlayed,
      };
    },
  });
}

// ─── Post-match self-reported stats (game_player_stats table) ──────────

export interface GamePlayerStats {
  goals: number;
  assists: number;
  distanceKm: number | null;
  rating: number | null;
}

const matchStatsKey = (gameId: string) => ["match-stats", gameId] as const;

/**
 * This player's already-submitted stats for a game, so the form can prefill.
 *
 * Without this the post-match form always opened at 0/0/null while the write
 * is an upsert, so re-opening it inside the 24h window and tapping submit
 * silently overwrote real figures with zeroes — and because get_my_activity()
 * recomputes XP from the row, the player's XP went DOWN.
 */
export function useMyMatchStats(gameId: string | null) {
  return useQuery({
    queryKey: matchStatsKey(gameId ?? ""),
    enabled: !!gameId,
    queryFn: async (): Promise<GamePlayerStats | null> => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from("game_player_stats")
        .select("goals, assists, distance_km, rating")
        .eq("game_id", gameId!)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      return {
        goals: data.goals ?? 0,
        assists: data.assists ?? 0,
        distanceKm: data.distance_km ?? null,
        rating: data.rating ?? null,
      };
    },
  });
}

export function useSubmitMatchStats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { gameId: string; goals: number; assists: number; distanceKm?: number; rating?: number }): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw { data: { error: "Not authenticated" } };
      const { error } = await supabase.from("game_player_stats").upsert({
        game_id: vars.gameId, user_id: userId, goals: vars.goals, assists: vars.assists,
        distance_km: vars.distanceKm ?? null, rating: vars.rating ?? null,
      });
      if (error) throw { data: { error: error.message } };
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: matchStatsKey(vars.gameId) });
      queryClient.invalidateQueries({ queryKey: ["my-activity"] });
      queryClient.invalidateQueries({ queryKey: ["my-stats"] });
    },
  });
}

// ─── Chat (game-group conversations, see the SQL migration) ────────────

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  kind: "direct" | "game_group";
  gameId: string | null;
  gameTitle: string | null;
  pitchName: string | null;
  pitchPhotoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
}

/** The user's group chats — one per game they've booked and opened chat for at least once. */
export function useMyConversations() {
  return useQuery({
    queryKey: ["my-conversations"],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return [];

      const { data: participantRows, error: pErr } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);
      if (pErr || !participantRows?.length) return [];

      const conversationIds = participantRows.map((r) => r.conversation_id);
      const { data: conversations, error: cErr } = await supabase
        .from("conversations")
        .select("id, kind, game_id, games(title, pitch_name)")
        .in("id", conversationIds);
      if (cErr || !conversations) return [];

      const pitchNames = conversations.map((c: any) => c.games?.pitch_name).filter(Boolean);
      const photos = await fetchPitchPhotos(pitchNames);

      // Last message per conversation — small N (one query per chat is fine at this scale).
      const withLastMessage = await Promise.all(
        conversations.map(async (c: any) => {
          const { data: lastMsg } = await supabase
            .from("messages")
            .select("body, created_at")
            .eq("conversation_id", c.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          return {
            id: c.id,
            kind: c.kind,
            gameId: c.game_id,
            gameTitle: c.games?.title ?? null,
            pitchName: c.games?.pitch_name ?? null,
            pitchPhotoUrl: c.games?.pitch_name ? (photos.get(c.games.pitch_name) ?? null) : null,
            lastMessage: lastMsg?.body ?? null,
            lastMessageAt: lastMsg?.created_at ?? null,
          } satisfies ConversationSummary;
        }),
      );

      return withLastMessage.sort((a, b) => {
        const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return tb - ta;
      });
    },
  });
}

/** Auto-creates (or returns) the game's group chat; throws if caller has no booking. */
export function useGetOrCreateGameChat() {
  return useMutation({
    mutationFn: async (vars: { gameId: string }): Promise<string> => {
      const { data, error } = await supabase.rpc("get_or_create_game_chat", { p_game_id: vars.gameId });
      if (error) throw { data: { error: error.message } };
      return data as string;
    },
  });
}

export function useConversationMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, queryClient]);

  return useQuery({
    queryKey: ["messages", conversationId ?? ""],
    enabled: !!conversationId,
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, body, created_at")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, body: m.body, createdAt: m.created_at,
      }));
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { conversationId: string; body: string }): Promise<void> => {
      const { data: { session } } = await supabase.auth.getSession();
      const senderId = session?.user?.id;
      if (!senderId) throw { data: { error: "Not authenticated" } };
      const { error } = await supabase.from("messages").insert({
        conversation_id: vars.conversationId, sender_id: senderId, body: vars.body.trim(),
      });
      if (error) throw { data: { error: error.message } };
    },
    onSuccess: (_data, vars) => queryClient.invalidateQueries({ queryKey: ["messages", vars.conversationId] }),
  });
}

// ─── Operator: delete game (mirrors web's manage.tsx) ──────────────────

export function useDeleteGame() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string }): Promise<void> => {
      const { error } = await supabase.from("games").delete().eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.games() }),
  });
}


// ─── Operator surface ──────────────────────────────────────────────────────
//
// The T-10 at-risk list (Figma 685:502). Kept separate from useGameRoster
// because it needs columns players must never see — phone numbers and booking
// age — and because it is gated on the operator role.

export interface OpsRosterEntry {
  bookingId: string;
  userId: string;
  name: string;
  /** Null when the player never added one; the call action hides in that case. */
  phone: string | null;
  bookedAt: string;
  checkedIn: boolean;
}

/** True when the signed-in user may see operator surfaces. */
export function useIsOperator() {
  return useQuery({
    queryKey: ["is-operator"],
    queryFn: async (): Promise<boolean> => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return false;
      const { data } = await supabase.from("users").select("role").eq("id", userId).single();
      return ["admin", "organiser", "host"].includes(data?.role ?? "");
    },
    staleTime: 5 * 60 * 1000,
  });
}

const opsRosterKey = (gameId: string) => ["ops-roster", gameId] as const;

/**
 * Everyone holding a spot, with the detail an operator needs to work the
 * phone. Ordered longest-standing booking first, which is the calling order
 * the screen's annotation specifies.
 */
export function useOpsRoster(gameId: string | null) {
  return useQuery({
    queryKey: opsRosterKey(gameId ?? ""),
    enabled: !!gameId,
    // The annotation asks for a 15s refresh while the screen is open.
    refetchInterval: 15_000,
    queryFn: async (): Promise<OpsRosterEntry[]> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, user_id, booked_at, checked_in, users(name, phone)")
        .eq("game_id", gameId!)
        .not("payment_status", "in", "(refunded,forfeited)")
        .order("booked_at", { ascending: true });
      if (error) throw error;

      return (data ?? []).map((b: any) => ({
        bookingId: b.id,
        userId: b.user_id,
        name: b.users?.name ?? "Player",
        phone: b.users?.phone ?? null,
        bookedAt: b.booked_at,
        checkedIn: b.checked_in ?? false,
      }));
    },
  });
}

export type ReleaseSpotResult = "ok" | "not_found" | "already_released" | "forbidden";

/**
 * Release a no-show's spot at T-10 so the pitch can be refilled.
 *
 * Backed by the `release_spot` RPC in supabase/2026-07-operator-surface.sql,
 * which is NOT YET APPLIED. Until it is, this throws and the screen surfaces
 * the error rather than pretending the spot was released.
 */
export function useReleaseSpot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { bookingId: string; gameId: string; operatorInitial: string }): Promise<ReleaseSpotResult> => {
      const { data, error } = await supabase.rpc("release_spot", {
        p_booking_id: vars.bookingId,
        p_operator_initial: vars.operatorInitial,
      });
      if (error) throw error;
      return data as ReleaseSpotResult;
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: opsRosterKey(vars.gameId) });
      queryClient.invalidateQueries({ queryKey: getGameRosterQueryKey(vars.gameId) });
    },
  });
}

export type CancelReason = "venue_closed" | "weather" | "not_enough_players";

/**
 * Operator cancellation (Figma 685:596). Writes the reason, moves every
 * booking to refund_pending, and notifies each booked player.
 *
 * Backed by the `cancel_match` RPC in supabase/2026-07-operator-surface.sql,
 * which is NOT YET APPLIED. Until then this throws and the screen reports that
 * nothing was sent, rather than claiming players were notified.
 */
export function useCancelMatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { gameId: string; reason: CancelReason }) => {
      const { data, error } = await supabase.rpc("cancel_match", {
        p_game_id: vars.gameId,
        p_reason: vars.reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.game(vars.gameId) });
      queryClient.invalidateQueries({ queryKey: qk.games() });
      queryClient.invalidateQueries({ queryKey: qk.myBookings });
    },
  });
}

// ─── Notification preferences ──────────────────────────────────────────────
//
// Backed by supabase/2026-07-notification-preferences.sql, NOT YET APPLIED.
// These were device-local, which the product owner correctly escalated to a
// blocker: the forfeit model assumes the player was told before he was
// penalised, and a preference the server cannot read suppresses nothing and
// proves nothing.
//
// While the table is missing the hooks fall back to the device copy so the
// screen still works, and `synced` reports false so the UI can say plainly
// that the setting is not yet enforced.

export interface NotificationPrefs {
  matchReminders: boolean;
  teamsAndCheckIn: boolean;
  spotOpened: boolean;
  headStart: boolean;
  matchChat: boolean;
  resultsAndAwards: boolean;
  newsAndOffers: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  matchReminders: true, teamsAndCheckIn: true,
  spotOpened: true, headStart: true,
  matchChat: true, resultsAndAwards: true,
  newsAndOffers: false,
};

const PREFS_LOCAL_KEY = "playos.notificationPrefs";

const rowToPrefs = (r: any): NotificationPrefs => ({
  matchReminders: r.match_reminders, teamsAndCheckIn: r.teams_and_check_in,
  spotOpened: r.spot_opened, headStart: r.head_start,
  matchChat: r.match_chat, resultsAndAwards: r.results_and_awards,
  newsAndOffers: r.news_and_offers,
});

const prefsToRow = (p: NotificationPrefs) => ({
  match_reminders: p.matchReminders, teams_and_check_in: p.teamsAndCheckIn,
  spot_opened: p.spotOpened, head_start: p.headStart,
  match_chat: p.matchChat, results_and_awards: p.resultsAndAwards,
  news_and_offers: p.newsAndOffers,
});

/** Postgres/PostgREST codes for "that table isn't there". */
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

export function useNotificationPrefs() {
  return useQuery({
    queryKey: ["notification-prefs"],
    queryFn: async (): Promise<{ prefs: NotificationPrefs; synced: boolean }> => {
      const local = await AsyncStorage.getItem(PREFS_LOCAL_KEY);
      const fallback: NotificationPrefs = local
        ? { ...DEFAULT_NOTIFICATION_PREFS, ...(JSON.parse(local) as Partial<NotificationPrefs>) }
        : DEFAULT_NOTIFICATION_PREFS;

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return { prefs: fallback, synced: false };

      const { data, error } = await supabase
        .from("notification_preferences").select("*").eq("user_id", userId).maybeSingle();

      if (error) {
        if (MISSING_TABLE.has(error.code ?? "")) return { prefs: fallback, synced: false };
        throw error;
      }
      if (!data) return { prefs: fallback, synced: false };
      return { prefs: rowToPrefs(data), synced: true };
    },
  });
}

export function useSetNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: NotificationPrefs): Promise<{ synced: boolean }> => {
      // Always keep the device copy so the screen survives a cold start.
      await AsyncStorage.setItem(PREFS_LOCAL_KEY, JSON.stringify(prefs));

      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return { synced: false };

      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: userId, ...prefsToRow(prefs), updated_at: new Date().toISOString() });

      if (error) {
        if (MISSING_TABLE.has(error.code ?? "")) return { synced: false };
        throw error;
      }
      return { synced: true };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-prefs"] }),
  });
}
