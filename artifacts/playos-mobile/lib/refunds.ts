/**
 * Cancellation refunds — the player-facing half of an operator/venue
 * cancellation (Figma "Refund 1 · Match cancelled" 668:697, "Refund 2 ·
 * Auto-refunded after 48h" 669:717, "Match · Auto-cancelled" 696:556).
 *
 * Ratified policy (July 2026), also written down in
 * supabase/2026-07-operator-surface.sql:
 *   • the player CHOOSES cash or a game token — never defaulted into a token
 *   • the streak is preserved EITHER WAY, it counts as a played week
 *   • no XP either way, because no game was played
 *   • the choice window is 48 hours, stamped server-side
 *   • after 48h with no choice we refund CASH automatically
 *   • game tokens expire 30 days after issue
 *
 * Lives here rather than in lib/api.ts so the refund screens have a home
 * without touching the shared data layer.
 *
 * BACKEND STATUS: `public.refund_choices` and the 48-hour settlement sweep are
 * specified in supabase/2026-07-operator-surface.sql, which is NOT YET
 * APPLIED. There is also no token ledger and no token-issuance RPC anywhere
 * (item 2 of that file's "still to build" list). So:
 *   • reads degrade to `unavailable` instead of throwing, and the screens say
 *     so rather than inventing a deadline;
 *   • the write path throws — see submitRefundChoiceNotImplemented below.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { useServerCountdown } from "./serverTime";

/** Hours the player has to choose cash or token. Server stamps the deadline. */
export const REFUND_WINDOW_HOURS = 48;

/**
 * Game-token lifetime. THIRTY, not sixty: the Figma copy on
 * "Refund 1 · Match cancelled" (node 680:542) still reads "expires in 60
 * days" and is stale — 30 days is the ratified number and is what the SQL
 * comment and these screens use. The Figma text needs correcting at source.
 */
export const TOKEN_EXPIRY_DAYS = 30;

/**
 * Auto-cancel floor: fewer than 10 of 12 checked in at T-10 and the match is
 * called off. Specified for the 12-player (6v6) format only — no floor has
 * been ratified for other capacities, so nothing here extrapolates one.
 */
export const AUTO_CANCEL_MIN_CHECKED_IN = 10;
export const AUTO_CANCEL_FORMAT_CAPACITY = 12;

export type RefundChoice = "cash" | "token";

/** One row of public.refund_choices, camel-cased. */
export interface RefundChoiceRow {
  bookingId: string;
  gameId: string;
  amount: number;
  choice: RefundChoice | null;
  chosenAt: string | null;
  /** Server-stamped deadline (created_at + 48h). Never derived on device. */
  decideBy: string;
  settledAt: string | null;
  createdAt: string;
}

export interface RefundChoiceResult {
  row: RefundChoiceRow | null;
  /**
   * True when the refund_choices table does not exist yet (migration
   * unapplied). Distinct from `row === null`, which means the table is there
   * and this booking simply has no cancellation against it.
   */
  unavailable: boolean;
}

/** Postgres "undefined_table" / PostgREST "table not in schema cache". */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42P01" || err.code === "PGRST205" || /refund_choices/.test(err.message ?? "");
}

export const refundChoiceKey = (bookingId: string) => ["refund-choice", bookingId] as const;

/**
 * The player's refund row for one booking. Returns `unavailable` rather than
 * throwing while the migration is unapplied, so the screen can render the real
 * booking data and be explicit about the missing deadline instead of erroring.
 */
export function useRefundChoice(bookingId: string | null) {
  return useQuery({
    queryKey: refundChoiceKey(bookingId ?? ""),
    enabled: !!bookingId,
    queryFn: async (): Promise<RefundChoiceResult> => {
      const { data, error } = await supabase
        .from("refund_choices")
        .select("booking_id, game_id, amount, choice, chosen_at, decide_by, settled_at, created_at")
        .eq("booking_id", bookingId!)
        .maybeSingle();

      if (error) {
        if (isMissingTable(error)) return { row: null, unavailable: true };
        throw error;
      }
      if (!data) return { row: null, unavailable: false };

      return {
        unavailable: false,
        row: {
          bookingId: data.booking_id,
          gameId: data.game_id,
          amount: Number(data.amount),
          choice: (data.choice as RefundChoice | null) ?? null,
          chosenAt: data.chosen_at ?? null,
          decideBy: data.decide_by,
          settledAt: data.settled_at ?? null,
          createdAt: data.created_at,
        },
      };
    },
  });
}

/**
 * Which of the two screens to show.
 *   choosing  → Refund 1, the window is open (or we cannot tell, see below)
 *   settled   → Refund 2, the money already moved or the window has closed
 */
export type RefundScreenState = "choosing" | "settled";

interface WindowInput {
  row: RefundChoiceRow | null;
  /** From useRefundWindow — server clock, never Date.now(). */
  expired: boolean;
}

export function refundScreenState({ row, expired }: WindowInput): RefundScreenState {
  if (!row) return "choosing";
  if (row.settledAt) return "settled";
  // The sweep job does not exist yet, so a row can sit past its deadline
  // unsettled. The deadline is what the player was promised, so the screen
  // follows the clock rather than waiting for a job that may never have run.
  if (expired) return "settled";
  return "choosing";
}

/**
 * Server-clock view of the 48-hour window. `deadlineMs` is null when we have
 * no server-stamped deadline (no row, or the table is missing) — in that case
 * `expired` is false and callers MUST NOT render a countdown, because there is
 * nothing behind it.
 */
export function useRefundWindow(decideBy: string | null | undefined) {
  const deadlineMs = decideBy ? Date.parse(decideBy) : NaN;
  const target = Number.isFinite(deadlineMs) ? deadlineMs : null;
  const { remainingMs, synced } = useServerCountdown(target);
  return {
    deadlineMs: target,
    remainingMs: target === null ? null : remainingMs,
    // Only ever true against a real server-stamped deadline.
    expired: target !== null && remainingMs <= 0,
    synced,
  };
}

/** The instant the choice opened — the deadline minus the window. */
export function refundChoiceOpenedAt(row: RefundChoiceRow): number {
  return Date.parse(row.decideBy) - REFUND_WINDOW_HOURS * 3_600_000;
}

/**
 * NOT IMPLEMENTED — there is no backend to write a refund choice to.
 *
 * Writing "cash" needs public.refund_choices (specified in
 * supabase/2026-07-operator-surface.sql, migration not applied) plus the
 * settlement sweep that actually moves the money. Writing "token" needs all of
 * that AND a token ledger with a 30-day expiry, which does not exist anywhere
 * in the schema — users.credits is a bare integer with no issue date, no
 * expiry and no audit trail, so incrementing it would silently mint money that
 * never expires.
 *
 * Deliberately throws rather than optimistically updating: this is the player
 * telling us what to do with their money, and a write that quietly goes
 * nowhere is worse than an error they can report.
 */
export async function submitRefundChoiceNotImplemented(vars: {
  bookingId: string;
  choice: RefundChoice;
}): Promise<never> {
  throw new Error(
    `Refund choice "${vars.choice}" cannot be saved yet: public.refund_choices is not migrated ` +
      `(supabase/2026-07-operator-surface.sql) and there is no token ledger to issue a ${TOKEN_EXPIRY_DAYS}-day ` +
      `token from. Nothing was changed for booking ${vars.bookingId}. ` +
      `The ${REFUND_WINDOW_HOURS}h auto-cash refund is unaffected.`,
  );
}

export function useSubmitRefundChoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitRefundChoiceNotImplemented,
    // Without this the screen cannot move. Its state is a pure function of the
    // refund row, so a successful write left useRefundChoice holding the stale
    // pre-choice row, refundScreenState kept returning "choosing", and the
    // player watched the spinner stop on the same two options — the same dead
    // end that was already fixed once in checkout. Latent while the write
    // throws; free to fix now, and wrong the moment the RPC lands.
    onSuccess: (_result, vars) =>
      queryClient.invalidateQueries({ queryKey: refundChoiceKey(vars.bookingId) }),
  });
}
