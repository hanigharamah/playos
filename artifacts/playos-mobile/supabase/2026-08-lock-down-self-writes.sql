-- ============================================================================
-- Stop players writing their own money, payment status and check-in
--
-- Found by a functional QA probe against the live database, 2026-08-03. Using
-- nothing but the anon key and an ordinary player session, it was able to:
--
--   * PATCH users.credits to 9999 (wallet balance is client-writable)
--   * PATCH bookings.payment_status to 'paid' (mark your own booking paid)
--   * PATCH bookings.checked_in to true (bypass the T-20 window entirely)
--
-- The last one matters most: check_in() exists precisely to enforce that the
-- window is server-side and cannot be moved by a device. A direct PATCH walks
-- straight around it, which also means the forfeit policy — "missing check-in
-- costs the full fee" — could be defeated by anyone willing to open a REST
-- client.
--
-- RLS policies cannot express "this row, but only these columns". Column-level
-- GRANTs can, so that is what this uses: revoke the blanket table UPDATE, then
-- grant back only the columns a player legitimately owns.
--
-- ORDER: apply AFTER 2026-08-seatmap-and-holds.sql.
-- ============================================================================

-- ── 1. users: name and phone are yours. Credits and role are not. ───────────
-- credits is a wallet balance. role gates the operator screens AND the RLS
-- policies behind them, so a self-settable role is a privilege escalation, not
-- just a cosmetic bug.
revoke update on public.users from authenticated;
grant  update (name, phone) on public.users to authenticated;

-- ── 2. bookings: how you'll pay, and whether you're still coming. ───────────
-- payment_method  — the player picks cash or STC Pay, that is theirs.
-- reconfirmed_at  — answering the T-12h ask, no money consequence.
--
-- Everything else is the server's: payment_status (money), checked_in and
-- checked_in_at (the T-20 window), team and slot_index (seat allocation, now
-- owned by claim_spot), hold_expires_at (the hold clock).
revoke update on public.bookings from authenticated;
grant  update (payment_method, reconfirmed_at) on public.bookings to authenticated;

-- ── 3. Cancelling has to keep working ───────────────────────────────────────
-- useCancelBooking writes payment_status directly today, and the revoke above
-- would break it. Same rules as the client enforced, but decided server-side
-- where the clock cannot be moved: more than FREE_CANCEL_HOURS out refunds,
-- inside it forfeits and releases the seat.
create or replace function public.cancel_my_booking(p_booking_id uuid)
returns table (status text, refunded boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  b            record;
  v_kickoff    timestamptz;
  v_free_hours int := 26;   -- keep in sync with FREE_CANCEL_HOURS in lib/api.ts
  v_eligible   boolean;
begin
  select bk.*, g.kickoff_time
    into b
    from public.bookings bk
    join public.games g on g.id = bk.game_id
   where bk.id = p_booking_id
     and bk.user_id = auth.uid();

  if not found then
    return query select 'not_found'::text, false;
    return;
  end if;
  if b.payment_status in ('refunded', 'forfeited') then
    return query select 'already_cancelled'::text, false;
    return;
  end if;

  v_kickoff  := b.kickoff_time;
  v_eligible := v_kickoff - now() > (v_free_hours || ' hours')::interval;

  update public.bookings
     set payment_status  = case when v_eligible then 'refunded' else 'forfeited' end,
         hold_expires_at = null
   where id = p_booking_id;

  -- Free the game up again if it had been marked full.
  update public.games set status = 'open'
   where id = b.game_id and status = 'full';

  return query select 'ok'::text, v_eligible;
end;
$$;

grant execute on function public.cancel_my_booking(uuid) to authenticated;

-- ── 4. Verifying ────────────────────────────────────────────────────────────
-- As a signed-in player, all three of these should now fail with 42501:
--
--   PATCH /rest/v1/users?id=eq.<me>        {"credits": 9999}
--   PATCH /rest/v1/bookings?id=eq.<mine>   {"payment_status": "paid"}
--   PATCH /rest/v1/bookings?id=eq.<mine>   {"checked_in": true}
--
-- And these should still succeed:
--
--   PATCH /rest/v1/users?id=eq.<me>        {"phone": "0500000000"}
--   PATCH /rest/v1/bookings?id=eq.<mine>   {"payment_method": "cash"}
--   PATCH /rest/v1/bookings?id=eq.<mine>   {"reconfirmed_at": "<now>"}
--
-- NOTE: this does not touch INSERT. The client still inserts its own booking
-- row directly; claim_spot in 2026-08-seatmap-and-holds.sql replaces that, and
-- INSERT should be revoked once the client is switched over. Doing it here
-- would break booking for anyone on an older build.
