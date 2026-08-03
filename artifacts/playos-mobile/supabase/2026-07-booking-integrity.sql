-- Booking integrity — two gaps found by the July 2026 audit.
--
-- NOT YET APPLIED. Review before running: the first statement will fail if the
-- table already contains duplicates, which is the point — see the check below.
--
-- Gap 1: nothing stops two players holding the same slot.
--   `useBookSpot` checks for collisions in the client before inserting, but two
--   devices can pass that check concurrently and both insert. Until the audit,
--   the client check was also filtering on payment_status = 'paid' while the
--   app only ever writes 'pending', so it never rejected anything at all.
--   The database is the only place this can actually be enforced.
--
-- Gap 2: there is no terminal state for "cancelled, no refund".
--   The flat 26-hour policy says a cancellation inside the cutoff forfeits the
--   money but still releases the spot. The current CHECK allows only
--   ('pending','paid','refunded'), so releasing the spot forces the row to
--   'refunded' — recording a refund that was never given. Every downstream
--   reconciliation reads that column.

begin;

-- ── Inspect before enforcing ────────────────────────────────────────────────
-- Run BOTH of these first. Either returning rows will abort the whole file,
-- since the indexes below cannot be created over existing duplicates.
--
-- 1. Two players on one slot:
--   select game_id, team, slot_index, count(*), array_agg(id)
--   from bookings
--   where payment_status not in ('refunded', 'forfeited')
--   group by game_id, team, slot_index
--   having count(*) > 1;
--
-- 2. One player holding two spots in the same game — this is the one that
--    actually fires in practice, because the client-side guard against it was
--    filtering on a status the app never writes:
--   select game_id, user_id, count(*), array_agg(id)
--   from bookings
--   where payment_status not in ('refunded', 'forfeited')
--   group by game_id, user_id
--   having count(*) > 1;
--
-- To clear the second kind, keeping the paid row if there is one and
-- otherwise the earliest:
--   delete from bookings b using (
--     select id, row_number() over (
--       partition by game_id, user_id
--       order by (payment_status = 'paid') desc, booked_at
--     ) as rn
--     from bookings where payment_status not in ('refunded', 'forfeited')
--   ) d
--   where b.id = d.id and d.rn > 1;

-- Drop first, don't skip: an earlier version of this file created these with
-- the predicate `payment_status <> 'refunded'`, which does NOT release the
-- slot on a forfeit. `create index if not exists` would leave that in place.
drop index if exists bookings_unique_active_slot;
drop index if exists bookings_unique_active_player;

-- ── Gap 1: one active booking per slot ──────────────────────────────────────
-- Partial index so released rows free the slot for reuse.
create unique index if not exists bookings_unique_active_slot
  on bookings (game_id, team, slot_index)
  where payment_status not in ('refunded', 'forfeited');

-- One active booking per player per game.
create unique index if not exists bookings_unique_active_player
  on bookings (game_id, user_id)
  where payment_status not in ('refunded', 'forfeited');

-- ── Gap 2: a real terminal state for a forfeited cancellation ───────────────
alter table bookings drop constraint if exists bookings_payment_status_check;

alter table bookings add constraint bookings_payment_status_check
  check (payment_status in ('pending', 'paid', 'refunded', 'forfeited'));

comment on column bookings.payment_status is
  'pending = booked, money not taken. paid = money taken. '
  'refunded = cancelled more than 26h before kickoff, money returned. '
  'forfeited = cancelled 26h or less before kickoff, spot released, money kept.';

commit;

-- After applying, update lib/api.ts useCancelBooking to write 'forfeited'
-- instead of 'refunded' when `eligible` is false, and add 'forfeited' to the
-- MyBooking paymentStatus union plus every occupancy filter that currently
-- reads `payment_status <> 'refunded'` (they must exclude forfeited too).
