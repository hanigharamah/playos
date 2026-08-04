-- ============================================================================
-- Run the 48-hour refund sweep
--
-- sweep_expired_refunds() has existed since 2026-08-refund-choice.sql and
-- nothing called it, so a player who never chose stayed un-refunded forever --
-- the exact case the 48h window was designed to resolve in their favour.
--
-- pg_cron 1.6.4 is already installed on this project, so this needs no
-- external scheduler, no Edge Function and no service-role key held anywhere.
-- The job runs inside the database as the postgres role;
-- sweep_expired_refunds is SECURITY DEFINER and takes no arguments, so there
-- is nothing for a caller to get wrong.
-- ============================================================================

-- Hourly, at 17 past. Two reasons for the offset over `0 * * * *`: every
-- scheduled job in every system defaults to the top of the hour, and a refund
-- settling at exactly xx:00 is indistinguishable in the logs from a dozen
-- other things firing at once.
--
-- Hourly rather than daily because decide_by is a per-row 48h stamp, not a
-- fixed time of day: a nightly job would leave a player waiting up to 24
-- extra hours past their deadline for money they are already owed. Hourly
-- bounds that at 59 minutes. The sweep is a single indexed UPDATE over rows
-- that are almost always zero, so the cost of running it 24x more often is
-- nil.
select cron.schedule(
  'sweep-expired-refunds',
  '17 * * * *',
  $$select public.sweep_expired_refunds()$$
);
