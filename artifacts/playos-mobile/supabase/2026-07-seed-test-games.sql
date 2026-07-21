-- ============================================================================
-- PlayOS mobile testing — seed 8 upcoming games spanning different days,
-- times of day, and team sizes, so the Play tab's filters (When/Time/
-- Players), Popular areas grouping, and the full booking → checkout →
-- chat flow all have real data to exercise.
--
-- Reuses the existing organiser_id (149b24ae-6d15-4954-840c-d3804bed5577)
-- already present on your other games — a valid FK, not invented.
-- Run in the Supabase SQL editor. Safe to run more than once (each run
-- adds 8 more games; delete via the query at the bottom if you want a
-- clean slate first).
-- ============================================================================

insert into public.games
  (organiser_id, title, pitch_name, kickoff_time, price, capacity, status, auto_cancel_hours, duration_minutes, is_public)
values
  -- Today, evening — 6v6
  ('149b24ae-6d15-4954-840c-d3804bed5577', 'Al Rowad Evening 6v6', 'Al Rowad', '2026-07-21T18:00:00+00:00', 30, 12, 'open', 4, 90, true),

  -- Tomorrow, morning — 7v7
  ('149b24ae-6d15-4954-840c-d3804bed5577', 'Arena Riyadh Morning 7v7', 'Arena Riyadh', '2026-07-22T08:00:00+00:00', 35, 14, 'open', 4, 90, true),

  -- Tomorrow, afternoon — 6v6
  ('149b24ae-6d15-4954-840c-d3804bed5577', 'KAFD Pitch Afternoon 6v6', 'KAFD Pitch', '2026-07-22T13:00:00+00:00', 28, 12, 'open', 4, 90, true),

  -- Tomorrow, evening — 8v8
  ('149b24ae-6d15-4954-840c-d3804bed5577', 'Al Rowad 8-a-side Night', 'Al Rowad 8 a side', '2026-07-22T19:00:00+00:00', 40, 16, 'open', 4, 90, true),

  -- Day after tomorrow, afternoon — 6v6
  ('149b24ae-6d15-4954-840c-d3804bed5577', 'King Fahd Arena Afternoon', 'King Fahd Arena', '2026-07-23T16:00:00+00:00', 32, 12, 'open', 4, 90, true),

  -- This weekend (Fri), evening — 6v6
  ('149b24ae-6d15-4954-840c-d3804bed5577', 'Al Rowad Friday Night', 'Al Rowad', '2026-07-24T20:00:00+00:00', 30, 12, 'open', 4, 90, true),

  -- This weekend (Sat), afternoon — 7v7
  ('149b24ae-6d15-4954-840c-d3804bed5577', 'Arena Riyadh Saturday 7v7', 'Arena Riyadh', '2026-07-25T14:00:00+00:00', 35, 14, 'open', 4, 90, true),

  -- Next week, evening — 8v8
  ('149b24ae-6d15-4954-840c-d3804bed5577', 'KAFD Pitch Next Week 8v8', 'KAFD Pitch', '2026-07-28T18:00:00+00:00', 40, 16, 'open', 4, 90, true);

-- ── Report ───────────────────────────────────────────────────────────────────
select id, title, pitch_name, kickoff_time, capacity, status
from public.games
where kickoff_time >= now()
order by kickoff_time;

-- ── To wipe just these seeded games and start over, run: ──────────────────────
-- delete from public.games
-- where title in (
--   'Al Rowad Evening 6v6', 'Arena Riyadh Morning 7v7', 'KAFD Pitch Afternoon 6v6',
--   'Al Rowad 8-a-side Night', 'King Fahd Arena Afternoon', 'Al Rowad Friday Night',
--   'Arena Riyadh Saturday 7v7', 'KAFD Pitch Next Week 8v8'
-- );
