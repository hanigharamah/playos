-- ============================================================================
-- Seat map + 5-minute spot holds
--
-- Two problems, one migration.
--
-- 1. THE PITCH IS BLIND. `bookings` RLS is self-only, so when game detail asks
--    for `games?select=*,bookings(...)` PostgREST silently returns ONLY the
--    caller's own booking — not an error, just a shorter list. The spot picker
--    therefore draws every seat as free on a full match, every tap fails on the
--    unique index with "someone just took that spot", and there is no full
--    state. Every guard inside useBookSpot is dead code for the same reason.
--
--    Fixed with get_game_seatmap(), a SECURITY DEFINER function that returns
--    WHICH SEATS ARE TAKEN AND NOTHING ELSE. No names, no user ids — the screen
--    does not need to know who, only which. That keeps the privacy the RLS
--    policy was protecting while giving the picker the truth.
--
-- 2. A PICKED SPOT IS HELD FOREVER. A booking row is written when the slot is
--    picked, BEFORE checkout, with payment_status 'pending'. Abandon checkout
--    and that row holds the seat indefinitely. claim_spot() now stamps a
--    five-minute hold, and expired holds are released the moment anyone else
--    tries to claim.
--
-- Apply AFTER 2026-07-booking-integrity.sql (it depends on that file's
-- bookings_unique_active_slot / bookings_unique_active_player indexes).
-- ============================================================================

-- ── 1. The hold column ──────────────────────────────────────────────────────
-- Null means "no hold": a paid booking, or a legacy row from before this
-- migration. Only pending rows are ever given a hold, and confirming payment
-- clears it.
alter table public.bookings
  add column if not exists hold_expires_at timestamptz;

comment on column public.bookings.hold_expires_at is
  'When an unpaid pending booking stops holding its seat. Null once paid.';

create index if not exists bookings_hold_expiry
  on public.bookings (hold_expires_at)
  where hold_expires_at is not null;

/** How long a picked-but-unpaid spot is held. */
create or replace function public.spot_hold_minutes()
returns int language sql immutable as $$ select 5 $$;

-- ── 2. Releasing expired holds ──────────────────────────────────────────────
-- The unique indexes cannot express "unless expired" — an index predicate must
-- be immutable and now() is not. So expiry is swept here instead, and both the
-- seat map and the claim path call it first. That way the indexes only ever
-- see live rows and stay exactly as strict as they are today.
create or replace function public.release_expired_holds(p_game_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.bookings
     set payment_status = 'forfeited'
   where game_id = p_game_id
     and payment_status = 'pending'
     and hold_expires_at is not null
     and hold_expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── 3. The seat map ─────────────────────────────────────────────────────────
-- Returns one row per OCCUPIED seat. Deliberately no user_id and no name: the
-- picker needs to know a seat is unavailable, not who is sitting in it. `mine`
-- is the single exception, because the screen must show the player their own
-- spot.
create or replace function public.get_game_seatmap(p_game_id text)
returns table (team int, slot_index int, mine boolean, held boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.release_expired_holds(p_game_id);

  return query
    select b.team,
           b.slot_index,
           b.user_id = auth.uid() as mine,
           -- A seat still inside its hold window, not yet paid.
           (b.payment_status = 'pending' and b.hold_expires_at is not null) as held
      from public.bookings b
     where b.game_id = p_game_id
       and b.payment_status not in ('refunded', 'forfeited');
end;
$$;

grant execute on function public.get_game_seatmap(text) to anon, authenticated;

-- ── 4. Claiming a spot ──────────────────────────────────────────────────────
-- Replaces the client-side insert. Every guard that useBookSpot performs in JS
-- is performed here instead, where it can actually see every booking rather
-- than only the caller's own.
--
-- Returns a status string so the client can say something specific:
--   ok | taken | already_booked | full | kicked_off | cancelled | no_such_game
create or replace function public.claim_spot(
  p_game_id    text,
  p_team       int,
  p_slot_index int
)
returns table (status text, booking_id uuid, hold_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  g            record;
  v_active     int;
  v_booking    uuid;
  v_expires    timestamptz;
begin
  if auth.uid() is null then
    return query select 'not_authenticated'::text, null::uuid, null::timestamptz;
    return;
  end if;

  perform public.release_expired_holds(p_game_id);

  select * into g from public.games where id = p_game_id;
  if not found then
    return query select 'no_such_game'::text, null::uuid, null::timestamptz;
    return;
  end if;
  if g.status = 'cancelled' then
    return query select 'cancelled'::text, null::uuid, null::timestamptz;
    return;
  end if;
  if g.kickoff_time is null or g.kickoff_time <= now() then
    return query select 'kicked_off'::text, null::uuid, null::timestamptz;
    return;
  end if;

  -- One spot per player per game.
  if exists (
    select 1 from public.bookings
     where game_id = p_game_id
       and user_id = auth.uid()
       and payment_status not in ('refunded', 'forfeited')
  ) then
    return query select 'already_booked'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select count(*) into v_active
    from public.bookings
   where game_id = p_game_id
     and payment_status not in ('refunded', 'forfeited');
  if v_active >= g.capacity then
    return query select 'full'::text, null::uuid, null::timestamptz;
    return;
  end if;

  -- The seat itself. Checked here rather than relying on the unique index, so
  -- the client gets "taken" instead of a raw 23505.
  if exists (
    select 1 from public.bookings
     where game_id = p_game_id
       and team = p_team
       and slot_index = p_slot_index
       and payment_status not in ('refunded', 'forfeited')
  ) then
    return query select 'taken'::text, null::uuid, null::timestamptz;
    return;
  end if;

  v_expires := now() + (public.spot_hold_minutes() || ' minutes')::interval;

  insert into public.bookings (game_id, user_id, team, slot_index, payment_status, hold_expires_at)
  values (p_game_id, auth.uid(), p_team, p_slot_index, 'pending', v_expires)
  returning id into v_booking;

  return query select 'ok'::text, v_booking, v_expires;
exception
  -- Two players claiming the same seat in the same instant: the unique index
  -- is still the final authority, and this turns its 23505 into a clean answer.
  when unique_violation then
    return query select 'taken'::text, null::uuid, null::timestamptz;
end;
$$;

grant execute on function public.claim_spot(text, int, int) to authenticated;

-- ── 5. Confirming payment clears the hold ───────────────────────────────────
-- Without this a paid booking would still carry an expiry and be swept.
create or replace function public.confirm_spot_payment(
  p_booking_id uuid,
  p_method     text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bookings
     set payment_method  = p_method,
         hold_expires_at = null
   where id = p_booking_id
     and user_id = auth.uid()
     and payment_status = 'pending';

  if not found then
    return 'not_found';
  end if;
  return 'ok';
end;
$$;

grant execute on function public.confirm_spot_payment(uuid, text) to authenticated;

-- NOTE: this deliberately does NOT set payment_status = 'paid'. Who marks cash
-- as received is an open product decision (the operator on the ops roster, the
-- existing web admin, or checkout itself). Clearing the hold is the part that
-- is unambiguous: the player has chosen how they will pay, so the seat is
-- theirs and must stop expiring.
