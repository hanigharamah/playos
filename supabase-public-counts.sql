-- ============================================================================
-- PlayOS — public game booking counts (no personal data)
--
-- Logged-out visitors can't read bookings rows (RLS only allows a player to
-- read their own booking, or an organiser their own game's bookings). That
-- means the Browse/Featured game cards show every game as 0 booked for
-- anyone not signed in — the fill bar and occupancy badge would be wrong for
-- exactly the audience the public pages are for.
--
-- This RPC returns COUNTS ONLY (game_id, booked_count) for public games —
-- no names, no user ids, no phone/email — so it's safe to expose to anon.
--
-- Run in the Supabase SQL editor. Safe to run more than once.
-- ============================================================================

create or replace function public.get_public_game_counts()
returns table (game_id text, booked_count int)
language sql
security definer
stable
set search_path = public
as $$
  select b.game_id, count(*)::int
  from public.bookings b
  join public.games g on g.id = b.game_id
  where g.is_public = true
    and g.status <> 'cancelled'
    and b.payment_status in ('paid', 'pending')
  group by b.game_id;
$$;

grant execute on function public.get_public_game_counts() to anon, authenticated;

-- ── Report ───────────────────────────────────────────────────────────────────
select 'get_public_game_counts fn' as item, count(*) as ok
  from pg_proc where proname = 'get_public_game_counts';
