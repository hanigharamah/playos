-- ============================================================================
-- PlayOS mobile testing — seed open games so the whole loop has real data:
-- browse → game detail → book → checkout → bookings → check-in → match day.
--
-- Run in the Supabase SQL editor. Safe to run repeatedly: it clears its own
-- seeded rows first, so you get the same eight games rather than eight more.
--
-- WHY THIS WAS REWRITTEN: the previous version hardcoded July 2026 dates.
-- They are all in the past now, and `useListGames` filters to
-- `kickoff_time >= now()`, so the app showed an empty feed everywhere — Home,
-- Play and Browse each fell through to their empty states. Times are relative
-- to when you run it, so this cannot go stale again.
-- ============================================================================

begin;

-- ── Clear a previous run of THIS seed only ──────────────────────────────────
-- Bookings cascade, so any test bookings against these games go with them.
delete from public.games where title like '[seed]%';

-- ── Eight games across the next week ────────────────────────────────────────
-- The organiser is resolved from the table rather than hardcoded, so this
-- works on any database without hand-editing a UUID.
with organiser as (
  select id from public.users
   where role in ('admin', 'organiser', 'host')
   order by created_at
   limit 1
),
picked as (
  -- Fall back to any user at all if no organiser role exists yet.
  select coalesce(
    (select id from organiser),
    (select id from public.users order by created_at limit 1)
  ) as id
)
insert into public.games
  (id, organiser_id, title, pitch_name, location_text, kickoff_time,
   price, capacity, status, auto_cancel_hours, duration_minutes, is_public)
select
  gen_random_uuid()::text, picked.id, g.title, g.pitch_name, g.location_text,
  date_trunc('hour', now()) + g.kickoff_in,
  g.price, g.capacity, 'open', 4, 90, true
from picked, (values
  -- Deliberately close, so check-in can be exercised without waiting a day:
  -- this one's check-in window opens roughly 40 minutes from now.
  ('[seed] Al Rowad Evening 6v6',       'Al Rowad',         'Al Olaya',   interval '1 hour',         30, 12),
  ('[seed] Arena Riyadh Tonight 7v7',   'Arena Riyadh',     'Al Nakheel', interval '4 hours',        35, 14),
  ('[seed] KAFD Pitch Morning 6v6',     'KAFD Pitch',       'Al Aqiq',    interval '1 day 9 hours',  28, 12),
  ('[seed] Al Rowad 8-a-side Night',    'Al Rowad 8 a side','Al Olaya',   interval '1 day 20 hours', 40, 16),
  ('[seed] King Fahd Arena Afternoon',  'King Fahd Arena',  'Hittin',     interval '2 days 15 hours',32, 12),
  ('[seed] Al Rowad Friday Night',      'Al Rowad',         'Al Olaya',   interval '3 days 20 hours',30, 12),
  ('[seed] Arena Riyadh Saturday 7v7',  'Arena Riyadh',     'Al Nakheel', interval '4 days 14 hours',35, 14),
  ('[seed] KAFD Pitch Next Week 8v8',   'KAFD Pitch',       'Al Aqiq',    interval '7 days 18 hours',40, 16)
) as g(title, pitch_name, location_text, kickoff_in, price, capacity);

commit;

-- ── Check what landed ───────────────────────────────────────────────────────
select title, pitch_name, location_text, kickoff_time, capacity, price
  from public.games
 where kickoff_time >= now()
 order by kickoff_time;

-- ── To remove them again ────────────────────────────────────────────────────
-- delete from public.games where title like '[seed]%';
--
-- The '[seed] ' prefix is what makes this re-runnable and reversible. Strip it
-- from a row only if you want that game to survive the next run.
