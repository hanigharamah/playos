-- ============================================================================
-- PlayOS — Flashcard match-day integration migration
-- Run in Supabase SQL editor. Safe to run more than once.
-- ============================================================================

-- ── §1.1  RLS: let players read co-players in the same game ─────────────────
-- The existing policy only lets a player read their OWN booking.
-- Without this, every count/roster in the flashcard shows only the caller.
drop policy if exists "bookings: read co-players in same game" on public.bookings;
create policy "bookings: read co-players in same game"
  on public.bookings for select
  using (
    game_id in (
      select b.game_id from public.bookings b where b.user_id = auth.uid()
    )
  );

-- ── §1.2  Realtime: stream booking changes to all subscribers ───────────────
-- Must land AFTER §1.1 — realtime respects RLS.
alter publication supabase_realtime add table public.bookings;

-- ── §2.1  games: persist the coin-flip winner once, server-side ─────────────
alter table public.games
  add column if not exists kickoff_team  smallint,       -- 1 or 2, null until decided
  add column if not exists teams_locked_at timestamptz;  -- when sides closed & flip ran

-- ── §2.2  bookings: team chosen on the day, not at booking time ─────────────
alter table public.bookings alter column team drop not null;
-- slot_index stays not-null for now; operator bookings still need it

-- ── §3.2  claim_side RPC — atomic, race-safe side pick ──────────────────────
-- Returns: 'ok' | 'full' | 'already_picked' | 'not_checked_in'
create or replace function public.claim_side(
  p_game_id text,
  p_team    smallint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_booking_id text;
  v_checked_in boolean;
  v_capacity   int;
  v_team_count int;
  v_next_slot  int;
begin
  -- Caller must have a checked-in booking for this game
  select id, checked_in
    into v_booking_id, v_checked_in
    from bookings
   where game_id = p_game_id
     and user_id = v_uid
     and payment_status in ('paid', 'pending')
   limit 1;

  if v_booking_id is null then
    return 'not_checked_in';
  end if;

  if not v_checked_in then
    return 'not_checked_in';
  end if;

  -- Already picked a side — idempotent
  if exists (
    select 1 from bookings
    where id = v_booking_id and team = p_team
  ) then
    return 'already_picked';
  end if;

  -- Count how many have claimed this side (exclude the caller)
  select g.capacity into v_capacity
    from games g where g.id = p_game_id;

  select count(*) into v_team_count
    from bookings
   where game_id = p_game_id
     and team = p_team
     and id != v_booking_id
     and payment_status in ('paid', 'pending');

  if v_team_count >= (v_capacity / 2) then
    return 'full';
  end if;

  -- Assign next free slot_index for this team
  select coalesce(max(slot_index), -1) + 1 into v_next_slot
    from bookings
   where game_id = p_game_id
     and team = p_team
     and payment_status in ('paid', 'pending');

  update bookings
     set team = p_team, slot_index = v_next_slot
   where id = v_booking_id;

  return 'ok';
end;
$$;

-- ── §3.3  lock_teams_and_flip RPC — decide kickoff once, server-side ────────
-- Returns: 'ok' | 'already_locked' | 'not_found'
create or replace function public.lock_teams_and_flip(
  p_game_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
  v_locked boolean;
begin
  select exists(select 1 from games where id = p_game_id) into v_exists;
  if not v_exists then return 'not_found'; end if;

  -- Guard: only run once
  select (kickoff_team is not null) into v_locked
    from games where id = p_game_id;
  if v_locked then return 'already_locked'; end if;

  update games
     set kickoff_team    = (floor(random() * 2) + 1)::smallint,
         teams_locked_at = now()
   where id = p_game_id
     and kickoff_team is null;  -- race-safe second guard

  return 'ok';
end;
$$;

-- ── Report ───────────────────────────────────────────────────────────────────
select 'RLS policy'   as item, count(*) as ok from pg_policies   where policyname = 'bookings: read co-players in same game'
union all
select 'kickoff_team column', count(*) from information_schema.columns where table_name='games' and column_name='kickoff_team'
union all
select 'teams_locked_at column', count(*) from information_schema.columns where table_name='games' and column_name='teams_locked_at'
union all
select 'claim_side rpc', count(*) from pg_proc where proname='claim_side'
union all
select 'lock_teams_and_flip rpc', count(*) from pg_proc where proname='lock_teams_and_flip';
