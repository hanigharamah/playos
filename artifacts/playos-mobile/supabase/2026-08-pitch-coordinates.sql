-- ============================================================================
-- Venue coordinates, so "pitches near you" can mean it
--
-- Browse now says "N pitches near you" and is meant to list nearest-first.
-- Nothing could back that: pitches had no location at all, so the list was
-- ordered by how many open games each venue had.
--
-- Null is the honest default and the client MUST handle it: a venue with no
-- coordinates shows no distance line and sorts after every venue that has
-- one, rather than being dropped or guessed at. Coordinates are typed in by
-- the operator -- four venues, four rows -- not derived from the name.
-- ============================================================================

alter table public.pitches
  add column if not exists lat double precision,
  add column if not exists lng double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pitches_latlng_range') then
    -- Both or neither, and both in range. A half-set pair is worse than none:
    -- it would sort as though it had a location and then compute a distance
    -- against a null, which reads as 0 km -- i.e. "closest".
    alter table public.pitches
      add constraint pitches_latlng_range
      check (
        (lat is null and lng is null)
        or (lat between -90 and 90 and lng between -180 and 180)
      );
  end if;
end $$;

comment on column public.pitches.lat is
  'WGS84 latitude. Null means unknown; the client must render no distance and '
  'sort the venue last rather than treating it as 0 km. Set together with lng.';
comment on column public.pitches.lng is
  'WGS84 longitude. See lat.';

-- The operator checklist gains the new gap. Dropped first: `create or replace
-- view` cannot insert a column in the middle, only append.
drop view if exists public.pitch_gaps;
create view public.pitch_gaps as
  select
    src.n                                   as pitch_name,
    p.id                                    as pitch_id,
    p.surface,
    p.photo_url,
    p.lat, p.lng,
    (select count(*) from public.games g
      where g.pitch_name = src.n and g.status = 'open') as open_games
  from (
    select distinct pitch_name as n from public.games
     where pitch_name is not null and pitch_name <> ''
  ) src
  left join public.pitches p on p.name = src.n;
