-- ============================================================================
-- Keep cron.job_run_details from eating the database
--
-- pg_cron writes one row per job execution and NEVER deletes them. Supabase
-- does not purge the table either. Measured on 2026-08-04, 17 days into this
-- project's life:
--
--   cron.job_run_details   11,874 rows   4.4 MB
--   whole database                       17 MB
--
-- So a quarter of the database is already an append-only log of jobs that
-- succeeded. It grows about 260 KB a day at the current rate and nothing
-- stops it.
--
-- Almost all of it is the match-reminders job at */2, which is 720 rows a day
-- on its own. sweep-expired-refunds adds 24 -- three percent of what is
-- already there -- so this is not about the sweep; the sweep just made the
-- growth worth looking at.
--
-- Seven days is kept because that is long enough to answer "did the sweep run
-- last night" and to see a weekly pattern, and short enough that the table
-- stops growing at roughly 5,000 rows.
-- ============================================================================

select cron.schedule(
  'prune-cron-log',
  -- Daily at 03:41. Off-hour and off-minute deliberately: this takes a lock on
  -- the log table, and doing that at the top of the hour puts it in contention
  -- with every other job that also defaults there.
  '41 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);
