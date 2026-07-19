-- ============================================================================
-- PlayOS — Flashcard RLS fix
--
-- Fixes three problems introduced by supabase-flashcard.sql:
--   1. Infinite recursion in the "read co-players" bookings policy — this is
--      what broke the operator calendar (every read of bookings errored).
--   2. Teammate names unreadable — the roster could only see the caller's own
--      users row, so everyone else showed as "Player".
--   3. Phone exposure — the co-player policy let any player read raw booking
--      rows, including guest_phone. Display now goes through an RPC that never
--      returns phone/email/user_id.
--
-- Design: keep a (non-recursive) co-player SELECT policy so Supabase Realtime
-- can still push teammates' live changes; do all name display through a
-- SECURITY DEFINER roster RPC that returns name + team + checked_in only.
--
-- Run in the Supabase SQL editor. Safe to run more than once.
-- ============================================================================

-- ── 1. Break the recursion ──────────────────────────────────────────────────
-- A SECURITY DEFINER function runs as its owner (BYPASSRLS), so the lookup
-- inside it does NOT re-trigger the bookings policy → no recursion.
create or replace function public.user_is_in_game(p_game_id text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.bookings
    where game_id = p_game_id
      and user_id = auth.uid()
  );
$$;

drop policy if exists "bookings: read co-players in same game" on public.bookings;
create policy "bookings: read co-players in same game"
  on public.bookings for select
  using ( public.user_is_in_game(game_id) );

-- ── 2 + 3. Roster RPC — names for the screen, no phone/email/user_id ────────
create or replace function public.get_game_roster(p_game_id text)
returns table (
  booking_id text,
  name       text,
  team       smallint,
  checked_in boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    b.id,
    coalesce(u.name, b.guest_name, 'Player') as name,
    b.team,
    coalesce(b.checked_in, false)
  from public.bookings b
  left join public.users u on u.id = b.user_id
  where b.game_id = p_game_id
    and b.payment_status in ('paid', 'pending')
    -- caller must have a booking in this game to see the roster
    and exists (
      select 1 from public.bookings me
      where me.game_id = p_game_id
        and me.user_id = auth.uid()
    );
$$;

grant execute on function public.user_is_in_game(text) to authenticated, anon;
grant execute on function public.get_game_roster(text) to authenticated, anon;

-- ── Report ───────────────────────────────────────────────────────────────────
select 'user_is_in_game fn'  as item, count(*) as ok from pg_proc where proname = 'user_is_in_game'
union all
select 'get_game_roster fn', count(*) from pg_proc where proname = 'get_game_roster'
union all
select 'co-player policy',   count(*) from pg_policies where policyname = 'bookings: read co-players in same game';
