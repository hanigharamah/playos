-- ============================================================================
-- Turn the seed rows into a presentable first week
--
-- The catalogue was still 2026-07-seed-test-games.sql output: every title
-- began with the literal "[seed]", and because kickoff_time was written in UTC
-- without thinking about the offset, the matches landed between 03:00 and
-- 09:00 Riyadh time. An App Store reviewer would have opened the app to five
-- fixtures called "[seed] ..." kicking off at four in the morning.
--
-- Times are written AT TIME ZONE 'Asia/Riyadh' so the stored timestamptz means
-- what the operator intends. Riyadh five-a-side is an evening game -- the heat
-- decides that, not preference -- so everything sits between 20:00 and 22:00.
--
-- These are PLACEHOLDER fixtures, plausible rather than booked with venues.
-- Replace them with the real slots before taking money. Prices and capacities
-- are carried over from the seed rows unchanged; they were never verified
-- either, and inventing new ones would not make them more true.
-- ============================================================================

update public.games set
  title = v.title,
  kickoff_time = v.local at time zone 'Asia/Riyadh'
from (values
  ('766b7c87-ab2e-4aca-b298-26d8822d0151', 'Wednesday 8-a-side', timestamp '2026-08-05 21:00'),
  ('fa7a3228-cfcc-48ba-9c6d-7e30612b8ad7', 'Thursday Night 6v6', timestamp '2026-08-06 22:00'),
  ('6649db3f-49dc-4dde-9309-9256caa29aa8', 'Friday Night 6v6',   timestamp '2026-08-07 21:00'),
  ('d9481032-c1b2-4cb0-b211-b853e5f041c8', 'Saturday 7v7',       timestamp '2026-08-08 20:00'),
  ('0695686a-06b6-4aa0-b43d-57eb23a6b479', 'Tuesday 8-a-side',   timestamp '2026-08-11 21:30')
) as v(id, title, local)
where public.games.id = v.id;

-- Anything else still carrying the marker, including past games that show in
-- history. Left in place rather than deleted -- a past match is a real record
-- of the app having been used -- but it should not read as scaffolding.
update public.games
   set title = trim(replace(title, '[seed]', ''))
 where title like '%[seed]%';
