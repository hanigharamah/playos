-- ============================================================================
-- Record the surfaces, and retire the 'nnnn' test venue
--
-- Owner decisions, 2026-08-04:
--   * no venue is indoor -- all four are outdoor
--   * 'nnnn' is a test row: cancel its games, drop the venue
--
-- The surfaces are set here rather than through set_pitch_surface() because
-- there is no operator screen yet. That RPC stays the intended route once
-- there is; this is the stopgap, written as a migration so the values are
-- recorded somewhere other than a shell history.
-- ============================================================================

begin;

-- -- 1. Surfaces -------------------------------------------------------------
-- Named explicitly rather than a blanket `set surface = 'outdoor'`: a venue
-- added tomorrow must start null so the operator is prompted for it, not
-- silently inherit a default that happens to be right today.
update public.pitches
   set surface = 'outdoor'
 where name in ('Al Rowad', 'KAFD Pitch', 'Arena Riyadh', 'King Fahd Arena');

-- -- 2. Retire 'nnnn' ---------------------------------------------------------
-- Cancelled, not deleted. One of the two games has a live booking, and the
-- app already handles cancellation properly: MatchDayBar has a cancelled
-- state that ignores the T-12h window and the Bookings tab shows a dot. Hard
-- -deleting the game would strand that booking with a dangling game_id and
-- tell the player nothing.
--
-- Both kickoffs are 2026-07-20, already a fortnight past, so no player is
-- waiting on either -- but the booking row is real and should end in a state
-- that reads correctly rather than vanishing.
update public.games
   set status = 'cancelled'
 where pitch_name = 'nnnn' and status <> 'cancelled';

-- The venue itself goes: pitch_name is not a foreign key, so the cancelled
-- games keep their label and only the operator's checklist loses the row.
delete from public.pitches where name = 'nnnn';

commit;
