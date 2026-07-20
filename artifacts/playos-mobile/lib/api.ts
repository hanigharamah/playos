/**
 * Data layer — mirrors ../playos/src/lib/supabase-api.ts. Same Supabase
 * project, same tables, same RLS. Hook names and shapes match the web app
 * wherever practical so logic (occupancy math, refund tiers, slot
 * assignment) isn't re-derived, it's ported.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

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
  paymentStatus: "pending" | "paid" | "refunded";
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

function mapGameSummary(g: Record<string, any>, bookedCount?: number): GameSummary {
  return {
    id: g.id,
    title: g.title,
    pitchName: g.pitch_name,
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
      return (data ?? []).map((g) => mapGameSummary(g, counts.get(g.id)));
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

      return { ...mapGameSummary(game, bookings.filter((b) => b.paymentStatus === "paid").length), bookings };
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

      const paidBookings = (game.bookings as any[]).filter((b) => b.payment_status === "paid");
      if (paidBookings.some((b) => b.user_id === user.id)) {
        throw { data: { error: "You already have a spot in this game" } };
      }

      const slotsPerTeam = game.capacity / 2;
      let assignedTeam = vars.team;
      let assignedSlot = vars.slotIndex;

      const slotTaken = paidBookings.some((b) => b.team === assignedTeam && b.slot_index === assignedSlot);
      if (slotTaken) {
        const used = new Set(paidBookings.filter((b) => b.team === assignedTeam).map((b) => b.slot_index));
        let found = false;
        for (let s = 0; s < slotsPerTeam; s++) {
          if (!used.has(s)) { assignedSlot = s; found = true; break; }
        }
        if (!found) {
          const other = assignedTeam === 1 ? 2 : 1;
          const otherUsed = new Set(paidBookings.filter((b) => b.team === other).map((b) => b.slot_index));
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
      if (insErr) throw insErr;

      queryClient.invalidateQueries({ queryKey: qk.game(vars.gameId) });
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

/** Refund tiers by time-to-kickoff — exact port of the web's useCancelBooking. */
export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { bookingId: string }): Promise<{ message: string }> => {
      const { data: booking } = await supabase
        .from("bookings").select("game_id, user_id, games(kickoff_time)").eq("id", vars.bookingId).single();

      const { error } = await supabase.from("bookings").update({ payment_status: "refunded" }).eq("id", vars.bookingId);
      if (error) throw error;

      const kickoff = (booking?.games as any)?.kickoff_time;
      const hoursUntil = kickoff ? (new Date(kickoff).getTime() - Date.now()) / 3_600_000 : 0;

      let message = "Booking cancelled. No refund applies this close to kickoff.";
      if (hoursUntil > 12) {
        message = "Booking cancelled. You'll receive a full refund.";
      } else if (hoursUntil >= 6) {
        const uidVal = booking?.user_id;
        if (uidVal) {
          const { data: u } = await supabase.from("users").select("credits").eq("id", uidVal).single();
          await supabase.from("users").update({ credits: (u?.credits ?? 0) + 1 }).eq("id", uidVal);
          queryClient.invalidateQueries({ queryKey: qk.myCredits });
        }
        message = "Booking cancelled. 1 credit token added for your next match.";
      }

      if (booking?.game_id) {
        await supabase.from("games").update({ status: "open" }).eq("id", booking.game_id).eq("status", "full");
        queryClient.invalidateQueries({ queryKey: qk.game(booking.game_id) });
      }
      queryClient.invalidateQueries({ queryKey: qk.myBookings });
      return { message };
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

      const now = new Date();
      const upcoming: MyBooking[] = [];
      const past: MyBooking[] = [];

      for (const b of data ?? []) {
        const g = b.games as any;
        const item: MyBooking = {
          id: b.id, gameId: b.game_id, team: b.team, slotIndex: b.slot_index,
          paymentStatus: b.payment_status, bookedAt: b.booked_at,
          game: {
            id: g.id, title: g.title, pitchName: g.pitch_name,
            kickoffTime: g.kickoff_time, price: Number(g.price),
            capacity: g.capacity, status: g.status,
          },
        };
        (new Date(g.kickoff_time) > now ? upcoming : past).push(item);
      }
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

/** Realtime roster — subscribes to booking/game changes so all players see the same state live. */
export function useGameRoster(gameId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!gameId) return;
    const channel = supabase
      .channel(`roster:${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `game_id=eq.${gameId}` }, () => {
        queryClient.invalidateQueries({ queryKey: getGameRosterQueryKey(gameId) });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, () => {
        queryClient.invalidateQueries({ queryKey: getGameRosterQueryKey(gameId) });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
  return useMutation({
    mutationFn: async (vars: { gameId: string; team: 1 | 2 }): Promise<ClaimSideResult> => {
      const { data, error } = await supabase.rpc("claim_side", { p_game_id: vars.gameId, p_team: vars.team });
      if (error) throw error;
      return data as ClaimSideResult;
    },
  });
}

export type StartMatchResult = "ok" | "already_locked" | "not_found" | "too_few";

/** Balances unpicked players/guests, locks teams, coin-flips kickoff side. */
export function useStartMatch() {
  return useMutation({
    mutationFn: async (vars: { gameId: string }): Promise<StartMatchResult> => {
      const { data, error } = await supabase.rpc("start_match", { p_game_id: vars.gameId });
      if (error) throw error;
      return data as StartMatchResult;
    },
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
