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
import { qk } from "./api";

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
 * Write the player's refund choice.
 *
 * Goes through the `choose_refund` RPC rather than updating `refund_choices`
 * directly, because three of the rules cannot be enforced from a client:
 *
 *   * the 48-hour deadline is checked against the SERVER clock — a device
 *     clock the player controls must not decide whether their window is open;
 *   * the row is locked for the duration, so two taps in flight cannot both
 *     read `choice` as null and issue two tokens for one cancellation;
 *   * a token is minted into `credit_tokens`, which the client cannot write
 *     to at all. It is a wallet; a client that can write to it can mint money.
 *
 * Cash is recorded but NOT settled: moving real money is the operator's job,
 * so `settledAt` stays null and the refund shows on their list. A token
 * settles immediately, because the 30-day expiry runs from the moment of
 * issue and the player has just asked for it.
 */
export async function submitRefundChoice(vars: {
  bookingId: string;
  choice: RefundChoice;
}): Promise<RefundChoiceRow> {
  const { data, error } = await supabase.rpc("choose_refund", {
    p_booking_id: vars.bookingId,
    p_choice: vars.choice,
  });

  // Surfaced, never swallowed: this is the player telling us what to do with
  // their money, and a write that quietly goes nowhere is worse than an error
  // they can report. The RPC's own messages are already player-readable
  // ("the 48 hour window closed on ..."), so they are passed through.
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No refund is pending for booking ${vars.bookingId}.`);

  const row: any = Array.isArray(data) ? data[0] : data;
  return {
    bookingId: row.booking_id,
    gameId: row.game_id,
    amount: Number(row.amount),
    choice: (row.choice as RefundChoice | null) ?? null,
    chosenAt: row.chosen_at ?? null,
    decideBy: row.decide_by,
    settledAt: row.settled_at ?? null,
    createdAt: row.created_at,
  };
}

export function useSubmitRefundChoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitRefundChoice,
    // Without this the screen cannot move. Its state is a pure function of the
    // refund row, so a successful write left useRefundChoice holding the stale
    // pre-choice row, refundScreenState kept returning "choosing", and the
    // player watched the spinner stop on the same two options — the same dead
    // end that was already fixed once in checkout.
    //
    // The booking list goes too: a token settles the refund immediately and
    // sets payment_status to 'refunded', which is what clears the cancelled
    // state off the match-day mini bar. Without this invalidation the player
    // makes their choice and the bar stays exactly as it was.
    onSuccess: (_result, vars) => {
      queryClient.invalidateQueries({ queryKey: refundChoiceKey(vars.bookingId) });
      queryClient.invalidateQueries({ queryKey: qk.myBookings });
    },
  });
}

/**
 * Every refund the player has outstanding, keyed by booking id.
 *
 * The match-day bar needs this to stop repeating itself. Choosing a TOKEN
 * settles the refund and marks the booking refunded, so it drops out of
 * useGetMyBookings and the bar clears on its own. Choosing CASH does not:
 * settling cash means an operator actually sending money, so the booking stays
 * `paid` and the bar kept telling the player to "choose cash or a token" after
 * they had already chosen cash — which is indistinguishable from the choice
 * not having saved.
 */
export function useMyRefundChoices() {
  return useQuery({
    queryKey: ["my-refund-choices"] as const,
    queryFn: async (): Promise<Map<string, { choice: RefundChoice | null; settledAt: string | null }>> => {
      const { data, error } = await supabase
        .from("refund_choices")
        .select("booking_id, choice, settled_at")
        .is("settled_at", null);

      // The table may not exist on an older deployment. An empty map degrades
      // the bar to its previous copy rather than breaking the whole screen.
      if (error) {
        if (isMissingTable(error)) return new Map();
        throw error;
      }
      return new Map(
        (data ?? []).map((r: any) => [
          r.booking_id as string,
          { choice: (r.choice as RefundChoice | null) ?? null, settledAt: r.settled_at ?? null },
        ]),
      );
    },
  });
}
