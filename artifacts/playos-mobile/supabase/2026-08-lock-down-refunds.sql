-- ============================================================================
-- Close four money holes found by executing against the database
--
-- 2026-08-lock-down-self-writes.sql established that client write access is
-- granted per column, never blanket — and then refund_choices and
-- credit_tokens were created afterwards and never got the same treatment.
--
-- ── HOLE 1: a player could mint a token of any value ────────────────────────
-- refund_choices had table-wide UPDATE for BOTH authenticated and anon, and
-- policy refund_choices_own_update had USING but no WITH CHECK. So the owning
-- player could `set amount = 99999` and then call choose_refund('token'),
-- which faithfully issued a 99,999 credit_token from a 32 riyal refund.
-- Reproduced live before this migration.
--
-- ── HOLE 2: the player controlled their own deadline ────────────────────────
-- Same grant let them `set decide_by = now() + interval '999 days'`, defeating
-- the 48-hour window choose_refund carefully enforces against the SERVER
-- clock. Enforcing a deadline the client can rewrite is not enforcement.
--
-- ── HOLE 3: anon could TRUNCATE the table ───────────────────────────────────
-- An unauthenticated caller held DELETE and TRUNCATE. Every refund owed to
-- every player, removable without signing in.
--
-- ── HOLE 4: two housekeeping functions were world-executable ────────────────
-- sweep_expired_refunds() has no operator check and default PUBLIC EXECUTE, so
-- anyone could settle everybody's pending refunds on demand. Same for
-- release_expired_holds(text), which frees seats on any game.
--
-- The client NEVER writes these tables directly — every legitimate change goes
-- through choose_refund, cancel_match or the sweep, all SECURITY DEFINER. So
-- the correct grant is none at all, not a narrower one.
-- ============================================================================

begin;

-- ── 1. No client writes to the money tables ─────────────────────────────────
revoke all on public.refund_choices from anon, authenticated;
revoke all on public.credit_tokens  from anon, authenticated;

-- Reading your own is fine and the screens need it; RLS still scopes it.
grant select on public.refund_choices to authenticated;
grant select on public.credit_tokens  to authenticated;

-- The UPDATE policy is now unreachable from the client, but a policy that
-- says one thing while granting another is how the next person gets this
-- wrong. Dropped rather than left as decoration.
drop policy if exists refund_choices_own_update on public.refund_choices;

comment on table public.refund_choices is
  'Never client-writable. amount and decide_by are money and a deadline; a '
  'player who can edit either can mint a token or reopen an expired window. '
  'All legitimate writes go through choose_refund / cancel_match / '
  'sweep_expired_refunds, which are SECURITY DEFINER.';

-- ── 2. Housekeeping functions are not public API ────────────────────────────
-- Both are called BY other SECURITY DEFINER functions, which run as the owner
-- and do not need the grant. Nothing legitimate calls them from a client.
revoke execute on function public.sweep_expired_refunds()      from public, anon, authenticated;
revoke execute on function public.release_expired_holds(text)  from public, anon, authenticated;

-- The pg_cron job runs as postgres, which owns them, so the hourly sweep is
-- unaffected. Verified after applying.

-- ── 3. A seat can no longer be claimed twice through a NULL team ────────────
-- bookings.team is nullable and claim_spot never validated p_team. Its
-- taken-check is `team = p_team`, and NULL = anything is NULL, so it never
-- matched — while the unique index does not dedupe NULLs either. Two live
-- bookings on one seat, reproduced live.
--
-- Validated in the function rather than made NOT NULL on the column: existing
-- rows may legitimately carry NULL, and a constraint that fails on write of
-- historical data is a worse outcome than a guard on the one path that
-- creates new bookings.
create or replace function public.claim_spot(
  p_game_id    text,
  p_team       int,
  p_slot_index int
)
returns table (status text, booking_id text, hold_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  g         record;
  v_active  int;
  v_booking text;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    return query select 'not_authenticated'::text, null::text, null::timestamptz;
    return;
  end if;

  -- Teams are 1 and 2; a slot is a non-negative index. Anything else is a
  -- malformed request, and NULL in particular used to slip past every check
  -- below on NULL-comparison semantics.
  if p_team is null or p_team not in (1, 2) or p_slot_index is null or p_slot_index < 0 then
    return query select 'bad_request'::text, null::text, null::timestamptz;
    return;
  end if;

  perform public.release_expired_holds(p_game_id);

  select * into g from public.games where id = p_game_id;
  if not found then
    return query select 'no_such_game'::text, null::text, null::timestamptz;
    return;
  end if;
  if g.status = 'cancelled' then
    return query select 'cancelled'::text, null::text, null::timestamptz;
    return;
  end if;
  if g.kickoff_time is null or g.kickoff_time <= now() then
    return query select 'kicked_off'::text, null::text, null::timestamptz;
    return;
  end if;
  -- The seat must exist on this pitch. Without this, slot_index 99 on a 12
  -- seat game was bookable and invisible to the picker.
  if p_slot_index >= floor(g.capacity / 2) then
    return query select 'bad_request'::text, null::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1 from public.bookings
     where game_id = p_game_id and user_id = auth.uid()
       and payment_status not in ('refunded', 'forfeited')
  ) then
    return query select 'already_booked'::text, null::text, null::timestamptz;
    return;
  end if;

  select count(*) into v_active
    from public.bookings
   where game_id = p_game_id and payment_status not in ('refunded', 'forfeited');
  if v_active >= g.capacity then
    return query select 'full'::text, null::text, null::timestamptz;
    return;
  end if;

  -- `is not distinct from` rather than `=`, so a legacy NULL row still counts
  -- as occupying its seat instead of silently matching nothing.
  if exists (
    select 1 from public.bookings
     where game_id = p_game_id
       and team is not distinct from p_team
       and slot_index is not distinct from p_slot_index
       and payment_status not in ('refunded', 'forfeited')
  ) then
    return query select 'taken'::text, null::text, null::timestamptz;
    return;
  end if;

  v_expires := now() + (public.spot_hold_minutes() || ' minutes')::interval;

  insert into public.bookings (id, game_id, user_id, team, slot_index, payment_status, hold_expires_at)
  values (gen_random_uuid()::text, p_game_id, auth.uid(), p_team, p_slot_index, 'pending', v_expires)
  returning id into v_booking;

  return query select 'ok'::text, v_booking, v_expires;
exception
  when unique_violation then
    return query select 'taken'::text, null::text, null::timestamptz;
end;
$$;

grant execute on function public.claim_spot(text, int, int) to authenticated;

commit;
