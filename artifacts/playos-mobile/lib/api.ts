/**
 * Data layer — mirrors ../playos/src/lib/supabase-api.ts. Same Supabase
 * project, same tables, same RLS. Hook names and shapes match the web app
 * wherever practical so logic (occupancy math, refund tiers, slot
 * assignment) isn't re-derived, it's ported.
 */
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { File } from "expo-file-system";
import { supabase } from "./supabase";
import { serverNow, syncServerTime } from "./serverTime";

// ─── Types ──────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  // Matches is_operator() in the database, which accepts admin | organiser |
  // host. "operator" was in this union and is not a real role; "organiser" was
  // missing and is. The row is typed `any` on the way in, so tsc never caught
  // the disagreement.
  role: "player" | "organiser" | "host" | "admin";
  /**
   * When this ACCOUNT was shown the notification pitch, whatever it answered.
   * Null means never asked. Lives on the account rather than in AsyncStorage
   * so it survives a reinstall — see 2026-08-onboarding-and-phone-identity.sql.
   */
  onboardingSeenAt: string | null;
  createdAt: string;
  /** 1-10, or null when no cartoon avatar has been picked. */
  avatarPreset: number | null;
  /**
   * Storage object path in the private `avatars` bucket, NOT a displayable
   * URL — sign it with `useSignedAvatarUrls` before handing it to <Avatar>.
   * Null for every player who has not uploaded one, which at launch is all of
   * them, so every consumer has to keep the initial fallback.
   *
   * Reads null rather than undefined while 2026-08-avatars.sql is unapplied:
   * `select *` simply won't return the column yet.
   */
  avatarUrl: string | null;
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
  /** Set by the check_in RPC inside the T-20 window. */
  checkedIn: boolean;
  /** When the player answered the T-12h ask. Null = unanswered. */
  reconfirmedAt: string | null;
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
  /** Null until an operator sets one. Callers must handle the absence. */
  whatsappUrl: string | null;
  stcpayNumber: string | null;
}

/**
 * Null, not a placeholder.
 *
 * These used to default to "05XXXXXXXX" and a bare WhatsApp domain, and both
 * columns are still NULL in the database — so checkout rendered a fabricated
 * phone number under STC Pay as though it were the number to send money to.
 * A made-up payment destination is worse than no payment method: the player
 * cannot tell it is fake, and an App Store reviewer reads it as an unfinished
 * app.
 *
 * With null, the number simply does not render (checkout already guards on
 * truthiness) and the row shows the method without a destination.
 */
const DEFAULT_SETTINGS: AppSettings = {
  whatsappUrl: null,
  stcpayNumber: null,
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
      bookedCount ??
      // Same rule as get_public_game_counts and get_game_seatmap: a seat is
      // taken unless the booking is terminal or its hold has lapsed. This
      // filtered on 'paid' — which nothing in the app ever writes — so the
      // fallback always returned 0 and advertised full games as empty.
      (g.bookings as any[] | undefined)?.filter(
        (b) =>
          b.payment_status !== "refunded" &&
          b.payment_status !== "forfeited" &&
          (!b.hold_expires_at || new Date(b.hold_expires_at).getTime() > serverNow()),
      ).length ??
      0,
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
  pitchMeta: ["pitch-meta"] as const,
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
        onboardingSeenAt: data.onboarding_seen_at ?? null,
        avatarPreset: data.avatar_preset ?? null,
        avatarUrl: data.avatar_url ?? null,
      };
    },
    retry: false,
  });
}

/**
 * Sends the password-reset email. Deliberately resolves the same way whether
 * or not the address has an account — telling a stranger which emails are
 * registered is an account-enumeration leak, and Supabase returns success
 * either way for that reason.
 *
 * NOTE: where the emailed link lands is the Site URL configured in Supabase,
 * not something this app controls. Completing the reset inside the app would
 * need a `playos://` redirect on the allowlist and a PASSWORD_RECOVERY branch
 * in lib/auth.tsx; neither exists yet.
 */
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (vars: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(vars.email);
      if (error) throw { data: { error: error.message } };
    },
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
        onboardingSeenAt: profile.onboarding_seen_at ?? null,
        avatarPreset: profile.avatar_preset ?? null,
        avatarUrl: profile.avatar_url ?? null,
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

      // Checked, not fired and forgotten. users_phone_key is unique now, so a
      // number already in use returns 23505 — and this used to report signup
      // as successful while leaving the account with phone = null, which is
      // exactly what the unique index was added to prevent.
      const { error: phoneErr } = await supabase
        .from("users")
        .update({ phone: normalizePhone(vars.phone) })
        .eq("id", auth.user.id);
      if (phoneErr) {
        throw {
          data: {
            error: (phoneErr as any).code === "23505"
              ? "That phone number is already registered. Sign in instead, or use another number."
              : "We couldn't save your phone number. Please try again.",
          },
        };
      }

      const { data: profile } = await supabase.from("users").select("*").eq("id", auth.user.id).single();
      if (!profile) throw { data: { error: "Profile creation failed" } };

      const user: AuthUser = {
        id: profile.id, email: profile.email, phone: profile.phone,
        name: profile.name, role: profile.role, createdAt: profile.created_at,
        onboardingSeenAt: profile.onboarding_seen_at ?? null,
        avatarPreset: profile.avatar_preset ?? null,
        avatarUrl: profile.avatar_url ?? null,
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
          // hold_expires_at is needed by the bookedCount fallback below: without
          // it every booking looks unheld and an expired hold is counted as an
          // occupied seat, which is the disagreement this rule exists to end.
          .select("*, bookings(id, payment_status, hold_expires_at)")
          .eq("is_public", true)
          .neq("status", "cancelled")
          // Server clock, like every other deadline in this app. The device
          // clock decided which matches were still bookable, so a phone set an
          // hour slow offered games that had already kicked off.
          .gte("kickoff_time", new Date(serverNow()).toISOString())
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
      // "Not found" and "could not reach the server" are different facts, and
      // collapsing them told a player on weak signal that their match had been
      // deleted — via MatchGone, which is convincing enough that they stop
      // trying and phone the operator. PGRST116 is PostgREST's no-rows result
      // from .single(); anything else is transport.
      if (error && (error as any).code !== "PGRST116") {
        throw { data: { error: error.message ?? "Couldn't load this match." }, notFound: false };
      }
      if (!game) throw { data: { error: "Game not found" }, notFound: true };

      // The join above is BLIND. `bookings` RLS is self-only, so PostgREST
      // returns only the caller's own row — not an error, just a shorter list.
      // That is why a game with nine players drew as nine empty seats: the
      // picker was told the truth about one booking and nothing about the
      // other eight. get_game_seatmap is SECURITY DEFINER and returns which
      // seats are taken and nothing else — no names, no user ids — so the
      // picker gets the truth without breaking the privacy the RLS policy
      // exists to protect.
      const { data: seatRows, error: seatErr } = await supabase.rpc("get_game_seatmap", {
        p_game_id: id,
      });
      if (seatErr) throw { data: { error: seatErr.message }, notFound: false };

      const ownRows: BookingRow[] = (game.bookings as any[]).map((b) => ({
        id: b.id, gameId: b.game_id, userId: b.user_id, team: b.team,
        slotIndex: b.slot_index, paymentStatus: b.payment_status,
        paymentMethod: b.payment_method, bookedAt: b.booked_at,
      }));

      // One synthetic row per occupied seat, with the caller's real row
      // substituted where the seat is theirs — checkout needs its id and
      // payment method, and only the caller's own row can supply those.
      // Everyone else's seat gets a null user id on purpose: the screen must
      // render it as taken and must not be able to say by whom.
      const seatmap = (seatRows ?? []) as { team: number; slot_index: number; mine: boolean; held: boolean }[];
      const bookings: BookingRow[] = seatmap.map((seat) => {
        const own = seat.mine
          ? ownRows.find((b) => b.team === seat.team && b.slotIndex === seat.slot_index)
          : undefined;
        return own ?? {
          id: `seat-${seat.team}-${seat.slot_index}`,
          gameId: id,
          userId: null as unknown as string,
          team: seat.team,
          slotIndex: seat.slot_index,
          // Occupied is occupied. The seat map already excludes refunded,
          // forfeited and expired holds, so anything it returns is live.
          paymentStatus: "pending",
          paymentMethod: null,
          bookedAt: null as unknown as string,
        };
      });

      const photos = await fetchPitchPhotos([game.pitch_name]);
      return {
        // Occupancy is the seat map's length, not a count of `paid` rows.
        // Nothing ever writes 'paid', so the old filter made every full game
        // advertise itself as empty.
        ...mapGameSummary(game, bookings.length, photos.get(game.pitch_name)),
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
    mutationFn: async (vars: { gameId: string; team: number; slotIndex: number }): Promise<{
      bookingId: string;
      /** When the hold lapses. Checkout counts down to this. */
      holdExpiresAt: string | null;
    }> => {
      // Every guard this used to run in JS ran against the blinded booking
      // list — it could see one row and was deciding whether a seat was free.
      // claim_spot performs the same checks inside the database, where it can
      // see all of them, and stamps the five-minute hold in the same
      // statement so a picked seat cannot be held forever by an abandoned
      // checkout.
      const { data, error } = await supabase.rpc("claim_spot", {
        p_game_id: vars.gameId,
        p_team: vars.team,
        p_slot_index: vars.slotIndex,
      });
      if (error) throw { data: { error: error.message } };

      const row = (data as { status: string; booking_id: string | null; hold_expires_at: string | null }[] | null)?.[0];
      if (!row) throw { data: { error: "Couldn't reach the pitch — pull to refresh and try again." } };

      // Refusals come back as DATA, not as an error. Reporting them as success
      // is the exact bug that made cancellation look like it worked while
      // nothing had changed.
      if (row.status !== "ok") {
        const message: Record<string, string> = {
          taken: "Someone just took that spot — pick another.",
          already_booked: "You already have a spot in this game.",
          full: "This match just filled up.",
          // claim_spot rejects a malformed team or an out-of-range slot. The
          // picker should never send one, so this is a bug on our side, not
          // something the player did.
          bad_request: "Something went wrong picking that spot — try another.",
          kicked_off: "This match has already kicked off.",
          cancelled: "This match has been cancelled.",
          no_such_game: "We couldn't find that match.",
          not_authenticated: "Sign in to book a spot.",
        };
        throw { data: { error: message[row.status] ?? "Couldn't take that spot." } };
      }
      if (!row.booking_id) throw { data: { error: "Couldn't take that spot." } };

      queryClient.invalidateQueries({ queryKey: qk.game(vars.gameId) });
      queryClient.invalidateQueries({ queryKey: qk.games() });
      queryClient.invalidateQueries({ queryKey: qk.myBookings });
      return { bookingId: row.booking_id, holdExpiresAt: row.hold_expires_at };
    },
  });
}

export function useConfirmPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { bookingId: string; gameId?: string; method: "cash" | "stcpay" }) => {
      // .select() so we can see WHETHER A ROW CHANGED, not merely that the
      // statement did not error. release_expired_holds() flips an abandoned
      // booking to 'forfeited' after five minutes; the filter below then
      // matches nothing, and the bare update returned error: null — so a
      // player whose hold had lapsed was told their spot was confirmed while
      // the seat was already free for somebody else.
      const { data, error } = await supabase
        .from("bookings")
        .update({ payment_method: vars.method })
        .eq("id", vars.bookingId)
        .in("payment_status", ["pending", "paid"])
        .select("id");

      if (error) throw { data: { error: "Something went wrong — please try again." } };
      if (!data || data.length === 0) {
        throw {
          data: {
            error: "Your hold on this spot expired, so it went back on sale. Pick a spot again.",
          },
          expired: true,
        };
      }
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.myBookings });
      // The match screen reads the game, not the booking list, and was left
      // saying "Finish checkout" after checkout finished.
      if (vars.gameId) queryClient.invalidateQueries({ queryKey: qk.game(vars.gameId) });
    },
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

      // Prefer the RPC. 2026-08-lock-down-self-writes.sql revokes the client's
      // UPDATE on payment_status — a player could previously PATCH their own
      // booking to 'paid' — so the direct write below stops working the moment
      // that migration is applied. Until then the RPC does not exist, so fall
      // back rather than breaking cancellation on the current database.
      const { data: rpcRows, error: rpcErr } = await supabase.rpc("cancel_my_booking", {
        p_booking_id: vars.bookingId,
      });
      const rpcMissing =
        !!rpcErr && ((rpcErr as any).code === "PGRST202" || /schema cache|does not exist/i.test(rpcErr.message ?? ""));
      if (rpcErr && !rpcMissing) throw rpcErr;

      // The RPC reports refusals as DATA, not as an error — so ignoring the
      // rows meant a 'not_found' or 'already_cancelled' was reported to the
      // player as "Booking cancelled" while nothing had changed.
      let serverRefunded: boolean | null = null;
      if (!rpcMissing) {
        const row = (rpcRows as { status: string; refunded: boolean }[] | null)?.[0];
        if (!row || row.status !== "ok") {
          throw {
            data: {
              error:
                row?.status === "already_cancelled"
                  ? "This booking was already cancelled."
                  : "We couldn't find that booking — pull to refresh and try again.",
            },
          };
        }
        serverRefunded = row.refunded;
      }

      if (rpcMissing) {
        const { error } = await supabase.from("bookings").update({ payment_status: terminal }).eq("id", vars.bookingId);
        // With the column-level grants applied this write is forbidden (42501).
        // If the RPC is also unreachable there is no path left, so say so
        // rather than reporting a cancellation that did not happen.
        if (error) {
          throw {
            data: {
              error:
                (error as any).code === "42501"
                  ? "Cancelling isn't available right now — please reload the app and try again."
                  : error.message,
            },
          };
        }
      }

      // Server's answer wins when we have one: it decided on its own clock.
      const refunded = serverRefunded ?? eligible;
      const message = refunded
        ? "Booking cancelled. You'll receive a full refund."
        : `Booking cancelled. No refund applies ${FREE_CANCEL_HOURS} hours or less before kickoff.`;

      if (booking?.game_id) {
        // cancel_my_booking already reopens the game; only the fallback needs to.
        if (rpcMissing) {
          await supabase.from("games").update({ status: "open" }).eq("id", booking.game_id).eq("status", "full");
        }
        queryClient.invalidateQueries({ queryKey: qk.game(booking.game_id) });
      }
      queryClient.invalidateQueries({ queryKey: qk.myBookings });
      return { message };
    },
  });
}

/**
 * First names of players already booked into a game, for social proof on the
 * promo hero. Names beat counts for turnout in a small community, and a bare
 * count can backfire — people read a number and assume they won't be missed.
 *
 * Deliberately NOT get_game_roster: that is gated to participants and returns
 * [] for a game you have not joined, which is exactly the case this serves.
 *
 * Degrades to null while 2026-08-game-lineup.sql is unapplied, so the card
 * simply shows its count instead of breaking.
 *
 * `players[i].avatarPath` arrives once 2026-08-avatars.sql is applied and is
 * a PRIVATE-BUCKET OBJECT PATH, not a URL — pass the collected paths through
 * `useSignedAvatarUrls` to get something <Avatar> can render. It is null for
 * anyone who has not uploaded, so the initial fallback stays load-bearing.
 * Reads null rather than undefined on the older function too, which simply
 * does not return the column.
 */
export interface LineupPlayer {
  firstName: string;
  avatarPath: string | null;
  /** 1-10 cartoon preset, or null. Photo wins over preset wins over initial. */
  avatarPreset: number | null;
}

export function useGameLineup(gameId: string | null, limit = 3) {
  return useQuery({
    queryKey: ["game-lineup", gameId ?? "", limit] as const,
    enabled: !!gameId,
    staleTime: 60_000,
    queryFn: async (): Promise<{ players: LineupPlayer[]; names: string[]; total: number } | null> => {
      const { data, error } = await supabase.rpc("get_game_lineup", {
        p_game_id: gameId!,
        p_limit: limit,
      });
      if (error) return null;
      const rows = (data ?? []) as {
        first_name: string | null;
        avatar_url?: string | null;
        avatar_preset?: number | null;
        total: number;
      }[];
      if (rows.length === 0) return null;
      // Drop the nameless in one pass rather than two, so a disc and the
      // sentence can never disagree about who is in the lineup.
      const players: LineupPlayer[] = rows
        .filter((r): r is typeof r & { first_name: string } => !!r.first_name)
        .map((r) => ({
          firstName: r.first_name,
          avatarPath: r.avatar_url ?? null,
          avatarPreset: r.avatar_preset ?? null,
        }));
      return {
        players,
        names: players.map((p) => p.firstName),
        total: Number(rows[0]?.total ?? 0),
      };
    },
  });
}

// ─── Avatars ────────────────────────────────────────────────────────────

/**
 * The `avatars` bucket is private (see 2026-08-avatars.sql): a player's photo
 * is visible to signed-in players and to nobody else, so there is no durable
 * public URL and `getPublicUrl` would hand back a link that 400s. Reads go
 * through short-lived signed URLs instead, which is what this mints.
 *
 * Batched deliberately — the promo card needs three at once, and
 * `createSignedUrls` does them in one round trip rather than three.
 *
 * Returns a path -> URL map. A path missing from the map (the object was
 * deleted out from under the row, the bucket is not created yet, the whole
 * call failed) resolves to undefined at the call site and lands on the
 * gradient initial, which is the same place a null path lands.
 */
const AVATAR_URL_TTL_SECONDS = 60 * 60;

export function useSignedAvatarUrls(paths: (string | null | undefined)[]) {
  // Sorted + deduped so that re-ordering the same three players doesn't miss
  // the cache, and so the key is stable across renders of a new array.
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p))).sort();
  return useQuery({
    queryKey: ["avatar-signed-urls", unique] as const,
    enabled: unique.length > 0,
    // Comfortably inside the TTL above, so a cached URL is never served after
    // it has expired.
    staleTime: (AVATAR_URL_TTL_SECONDS / 2) * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrls(unique, AVATAR_URL_TTL_SECONDS);
      if (error || !data) return {};
      const map: Record<string, string> = {};
      for (const row of data) {
        // createSignedUrls reports per-object failure inline rather than
        // throwing, so a single missing object must not lose the other two.
        if (row.signedUrl && row.path) map[row.path] = row.signedUrl;
      }
      return map;
    },
  });
}

/**
 * Replace my avatar: upload the bytes, then point users.avatar_url at them.
 *
 * Fixed key of `<user_id>/avatar.jpg` with upsert, because the storage policy
 * derives ownership from the first path segment and a fixed name means
 * changing your photo five times leaves one object, not five orphans.
 *
 * Order matters. The upload happens FIRST and the column is written only if
 * it succeeded, so a failed upload leaves the row pointing at the old photo
 * rather than at an object that does not exist. The reverse order would show
 * every other player a broken disc.
 */
export function useUploadMyAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { uri: string; mimeType?: string | null }): Promise<string> => {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw { data: { error: "You need to be signed in to set a photo." } };

      // expo-file-system's File.bytes() rather than the picker's base64
      // option: it avoids holding a ~33%-larger base64 copy of the image in
      // JS memory, and supabase-js takes the Uint8Array directly.
      // .buffer rather than the Uint8Array view: React Native's fetch is
      // reliable with a plain ArrayBuffer body, and this is the same shape the
      // usual base64 `decode()` recipe produces.
      const bytes = await new File(vars.uri).bytes();

      const path = `${userId}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, bytes.buffer, {
          contentType: vars.mimeType || "image/jpeg",
          upsert: true,
        });
      if (uploadError) throw { data: { error: uploadError.message } };

      const { error: rowError } = await supabase
        .from("users")
        .update({ avatar_url: path })
        .eq("id", userId);
      if (rowError) throw { data: { error: rowError.message } };

      return path;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.me });
      // The path is unchanged on a re-upload, so nothing about the lineup's
      // avatar_url differs — but the bytes behind it do. Drop the signed URLs
      // as well or the card keeps showing the previous photo until the TTL.
      queryClient.invalidateQueries({ queryKey: ["avatar-signed-urls"] });
      queryClient.invalidateQueries({ queryKey: ["game-lineup"] });
    },
  });
}

/**
 * "Ali and Ahmed are in" / "Ali, Ahmed and 4 others are in".
 *
 * NOT "also joining" — that reads as though the viewer is already in the game,
 * and this card exists to promote one they have not booked.
 */
export function lineupSentence(names: string[], total: number): string | null {
  if (names.length === 0) return null;
  const others = Math.max(0, total - names.length);
  if (names.length === 1) {
    return others > 0
      ? `${names[0]} and ${others} ${others === 1 ? "other" : "others"} are in`
      : `${names[0]} is in`;
  }
  const head = names.slice(0, -1).join(", ");
  const tail = names[names.length - 1];
  if (others > 0) return `${head}, ${tail} and ${others} ${others === 1 ? "other" : "others"} are in`;
  return `${head} and ${tail} are in`;
}

/**
 * Today's open games, ranked for CONVERSION rather than by kickoff time.
 *
 * Fill descending: a 9/12 game is one nudge from happening, a 3/12 six hours
 * out is likely to be cancelled. The buyer's real risk is cancellation, and
 * fill ratio is the visible proxy for it — the same near-goal effect that makes
 * Kickstarter campaigns past halfway fund over 95% of the time. Sorting by
 * soonest kickoff, the obvious default, buries the game that most needs three
 * more players.
 *
 * Falls back to the rest of the week when today is empty: an empty Home is
 * worse than a slightly stale one.
 */
export function rankOpenGames(games: GameSummary[], nowMs: number): {
  games: GameSummary[];
  isToday: boolean;
} {
  const open = games.filter(
    (g) => g.status !== "cancelled" && g.capacity - g.bookedCount > 0 && new Date(g.kickoffTime).getTime() > nowMs,
  );
  const sameDay = (g: GameSummary) => {
    const d = new Date(g.kickoffTime);
    const n = new Date(nowMs);
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  };
  const byFill = (a: GameSummary, b: GameSummary) => {
    const fa = a.capacity ? a.bookedCount / a.capacity : 0;
    const fb = b.capacity ? b.bookedCount / b.capacity : 0;
    if (fb !== fa) return fb - fa;
    // Same fill: the sooner one is the more urgent sell.
    return new Date(a.kickoffTime).getTime() - new Date(b.kickoffTime).getTime();
  };

  const today = open.filter(sameDay).sort(byFill);
  if (today.length > 0) return { games: today, isToday: true };
  return { games: open.sort(byFill), isToday: false };
}

/**
 * How close a game is to being viable, for honest labelling. Below the
 * threshold we say what it NEEDS rather than what is left — "needs 6 more"
 * instead of "6 spots left" — so nobody books a match expecting it to happen.
 */
export function gameFillLabel(g: GameSummary): { text: string; atRisk: boolean } {
  const spots = g.capacity - g.bookedCount;
  const short = MIN_PLAYERS_TO_START - g.bookedCount;
  if (short > 0) return { text: `needs ${short} more`, atRisk: true };
  return { text: `${spots} ${spots === 1 ? "spot" : "spots"} left`, atRisk: false };
}

/**
 * Pick one of the ten cartoon avatars. A single column write, which is why
 * this is the option every player can use on day one: no bucket, no upload,
 * no permission prompt, no moderation. The column grant in
 * 2026-08-avatar-presets.sql is what makes it self-writable, and a check
 * constraint rejects an id the app could not render.
 */
export function useSetAvatarPreset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { preset: number | null }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) throw { data: { error: "Not signed in" } };
      const { error } = await supabase
        .from("users").update({ avatar_preset: vars.preset }).eq("id", uid);
      if (error) {
        throw {
          data: {
            error:
              (error as any).code === "42501"
                ? "Couldn't save that — please reload the app and try again."
                : error.message,
          },
        };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.me });
      // Every promo card carries this player's disc.
      queryClient.invalidateQueries({ queryKey: ["game-lineup"] });
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
          checkedIn: b.checked_in ?? false,
          reconfirmedAt: b.reconfirmed_at ?? null,
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
// Mirrors ../playos/src/lib/supabase-api.ts's flashcard section.
// Check-in is a TAP BOUND TO THE CLOCK — see useCheckIn below and the
// `check_in` RPC, which enforces the T-20 window server-side. There is no QR
// code and no geofence; the web's /checkin/[pitchId] page and its
// `check_in_by_pitch` RPC are superseded and are not ported. The mobile
// match-day flow (app/match/[id].tsx) does check-in, side-claiming and start.

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


// ─── Match day ─────────────────────────────────────────────────────────────
//
// Backed by supabase/2026-08-match-day.sql. Check-in is bound to the clock and
// never to a place — the T-20 window is enforced inside the RPC, not here,
// because a phone's clock is not evidence.

export type CheckInResult =
  | "ok" | "not_found" | "no_booking" | "already_checked_in" | "too_early" | "too_late";

export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { gameId: string }): Promise<CheckInResult> => {
      const { data, error } = await supabase.rpc("check_in", { p_game_id: vars.gameId });
      if (error) throw error;
      return data as CheckInResult;
    },
    onSuccess: (_r, vars) => {
      queryClient.invalidateQueries({ queryKey: qk.myBookings });
      queryClient.invalidateQueries({ queryKey: getGameRosterQueryKey(vars.gameId) });
    },
  });
}

/**
 * The T-12h "still coming tonight?" answer. Carries no money consequence —
 * it exists so the ask can stop being asked.
 */
export function useReconfirmBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { bookingId: string }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ reconfirmed_at: new Date().toISOString() })
        .eq("id", vars.bookingId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.myBookings }),
  });
}

// ─── Pitches ────────────────────────────────────────────────────────────

/** What the operator has recorded about a venue, beyond its name. */
export type PitchMeta = {
  surface: "indoor" | "outdoor" | null;
  lat: number | null;
  lng: number | null;
};

/**
 * Venue metadata, keyed by name.
 *
 * Keyed by NAME rather than id because games.pitch_name is denormalized free
 * text with no foreign key — the same reason fetchPitchPhotos matches on name.
 * A game whose pitch_name has no matching row simply gets no metadata, which
 * is the typo case the pitch_gaps view exists to surface to the operator.
 *
 * Fetched once for the whole table rather than per visible venue: there are
 * four rows, and an `.in()` list would re-fetch on every keystroke as the
 * search narrows the venue list.
 */
export function usePitchMeta() {
  return useQuery({
    queryKey: qk.pitchMeta,
    // Coordinates and surface change when an operator edits them, which is
    // approximately never. An hour keeps the list from re-sorting mid-scroll.
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<Map<string, PitchMeta>> => {
      const { data, error } = await supabase
        .from("pitches")
        .select("name, surface, lat, lng");
      if (error) throw error;
      return new Map(
        (data ?? []).map((p: any) => [
          p.name as string,
          {
            surface: (p.surface as PitchMeta["surface"]) ?? null,
            // The DB constraint guarantees lat and lng are set together, so a
            // half-pair cannot arrive here and be read as 0 km.
            lat: p.lat ?? null,
            lng: p.lng ?? null,
          },
        ]),
      );
    },
  });
}

// ─── Spot holds ─────────────────────────────────────────────────────────

/**
 * When this booking's seat stops being held.
 *
 * claim_spot stamps a five-minute hold so an abandoned checkout cannot sit on
 * a seat forever. Null means no hold — a paid booking, or a row from before
 * the hold column existed. Checkout counts down to this; the value is read
 * back from the database rather than passed through navigation params, so a
 * player who backgrounds the app and returns sees the real remaining time
 * rather than a timer that restarted.
 */
export function useSpotHold(bookingId: string | null) {
  return useQuery({
    queryKey: ["spot-hold", bookingId] as const,
    enabled: !!bookingId,
    // The seat is only held for five minutes; a stale answer here is the
    // difference between a player thinking they have time and losing the spot.
    staleTime: 0,
    queryFn: async (): Promise<{ expiresAt: string | null }> => {
      const { data, error } = await supabase
        .from("bookings")
        .select("hold_expires_at")
        .eq("id", bookingId!)
        .maybeSingle();
      if (error) throw error;
      return { expiresAt: data?.hold_expires_at ?? null };
    },
  });
}

// ─── Account deletion ───────────────────────────────────────────────────

/** What delete_my_account() can answer. See supabase/2026-08-delete-account.sql. */
export type DeleteAccountResult = "ok" | "not_authenticated" | "is_organiser" | "has_balance";

/**
 * Delete the signed-in player's account and everything attached to it.
 *
 * Required by App Store Review Guideline 5.1.1(v): an app that creates
 * accounts must let you delete one from inside the app.
 *
 * Goes through an RPC because the client cannot do this safely or at all.
 * Deleting the auth row needs privileges the anon key does not have, and two
 * foreign keys make a naive delete destructive: games.organiser_id and
 * pitches.organiser_id CASCADE, so deleting an organiser would take the whole
 * catalogue and every other player's bookings with it.
 *
 * Refusals come back as DATA, not errors — the caller must branch on the
 * returned string rather than treating a non-throw as success.
 */
export function useDeleteMyAccount() {
  return useMutation({
    mutationFn: async (): Promise<DeleteAccountResult> => {
      const { data, error } = await supabase.rpc("delete_my_account");
      if (error) throw new Error(error.message);
      return (data as DeleteAccountResult) ?? "not_authenticated";
    },
  });
}

/**
 * Record that this account has been shown the notification pitch.
 *
 * Written by BOTH branches of onboarding — enabling and skipping — because the
 * question being answered is "have we asked?", not "did they say yes". Writing
 * it only on success would re-pitch anyone who declined, on every launch.
 *
 * 2026-08-onboarding-and-phone-identity.sql grants UPDATE on this single
 * column, so this is a direct write rather than an RPC: there is nothing here
 * a player could set to their own advantage.
 */
export function useMarkOnboardingSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      if (!uid) return;
      await supabase
        .from("users")
        .update({ onboarding_seen_at: new Date().toISOString() })
        .eq("id", uid);
    },
    // Refresh `me` so app/index.tsx stops redirecting back to onboarding.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.me }),
  });
}
