-- ============================================================================
-- Collapse the Al Rowad spellings into one venue
--
-- games.pitch_name is free text with no constraint, so four spellings of one
-- venue accumulated. Browse groups by that string, so players see four Al
-- Rowads:
--
--   'Al Rowad'           8 games   <- canonical, keep
--   'Al Rowad '          2 games   <- trailing space
--   'Al Rowad 8 a side'  3 games   <- pitch size, not a venue
--   'ALROWAD PITCH'      1 game    <- shouting
--
-- The 8-a-side distinction is NOT lost by merging: capacity already carries
-- it (those games are 16, the others 10-12), and it is a property of the game
-- rather than of the venue. Nothing else about a game changes here -- only
-- the venue label it groups under.
--
-- Re-runnable: the update is a no-op once the names are canonical.
-- ============================================================================

begin;

-- -- 1. Move the games --------------------------------------------------------
update public.games
   set pitch_name = 'Al Rowad'
 where pitch_name in ('Al Rowad ', 'Al Rowad 8 a side', 'ALROWAD PITCH');

-- -- 2. Retire the pitch rows those spellings created -------------------------
-- 2026-08-pitch-surface.sql seeded one pitches row per distinct spelling, so
-- the variants have rows of their own. They are unreferenced by anything --
-- pitch_name is not a foreign key -- so removing them is safe, and leaving
-- them would put dead venues in the operator's pitch_gaps checklist.
delete from public.pitches
 where name in ('Al Rowad ', 'Al Rowad 8 a side', 'ALROWAD PITCH');

-- Make sure the survivor exists even if the canonical spelling never had a
-- row of its own.
insert into public.pitches (id, organiser_id, name)
select 'pitch-al-rowad',
       (select organiser_id from public.games where pitch_name = 'Al Rowad' order by created_at limit 1),
       'Al Rowad'
where not exists (select 1 from public.pitches where name = 'Al Rowad')
  and exists (select 1 from public.games where pitch_name = 'Al Rowad');

-- -- 3. Stop the next one -----------------------------------------------------
-- The merge fixes today's data; this stops tomorrow's. A trailing space is the
-- single most common way this happened and the one a human will never see in
-- an input field, so it is trimmed on the way in. Case and wording still need
-- the operator screen (or a picker) to fully solve -- this is a guard, not a
-- substitute for that.
create or replace function public.trim_pitch_name()
returns trigger
language plpgsql
as $$
begin
  new.pitch_name := nullif(btrim(new.pitch_name), '');
  return new;
end;
$$;

drop trigger if exists games_trim_pitch_name on public.games;
create trigger games_trim_pitch_name
  before insert or update of pitch_name on public.games
  for each row execute function public.trim_pitch_name();

commit;
