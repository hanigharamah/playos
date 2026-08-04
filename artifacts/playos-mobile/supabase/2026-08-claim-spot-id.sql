-- ============================================================================
-- claim_spot never inserted an id, so it could not insert at all
--
-- bookings.id is TEXT NOT NULL with no default -- every previous writer
-- generated the id on the client (lib/api.ts called uid()). claim_spot omits
-- it, so the insert raised 23502 on every call and booking a spot was broken
-- outright the moment the client switched to the RPC.
--
-- tsc was clean and the iOS bundle exported. Only executing it found this.
--
-- Fixed in two places on purpose:
--   * a DEFAULT on the column, so no future writer can forget again;
--   * an explicit id in claim_spot, so it does not depend on that default
--     being present in an environment where the migration has not run.
-- ============================================================================

begin;

-- gen_random_uuid()::text, not a bespoke format: the ids already in the table
-- are a mix of uuid strings, 'demo-...' and 'verify-guest-...', so nothing
-- parses them and uniqueness is the only requirement.
alter table public.bookings
  alter column id set default gen_random_uuid()::text;

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

  -- The seat itself, so the client gets 'taken' rather than a raw 23505.
  if exists (
    select 1 from public.bookings
     where game_id = p_game_id and team = p_team and slot_index = p_slot_index
       and payment_status not in ('refunded', 'forfeited')
  ) then
    return query select 'taken'::text, null::text, null::timestamptz;
    return;
  end if;

  v_expires := now() + (public.spot_hold_minutes() || ' minutes')::interval;

  -- id supplied explicitly. The column now has a default too, but relying on
  -- it alone would make this function silently environment-dependent.
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
