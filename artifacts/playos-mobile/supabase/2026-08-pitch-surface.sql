-- ============================================================================
-- Real pitch rows, a surface the operator sets, and the photo column the app
-- has been reading all along
--
-- THREE things are wrong today and this fixes all three:
--
--  1. public.pitches has ONE row, named 'nnnn'. The four venues players
--     actually book -- KAFD Pitch, Arena Riyadh, Al Rowad, King Fahd Arena --
--     exist only as free text in games.pitch_name. There is nothing for an
--     operator to attach a surface, a photo or a map link TO.
--
--  2. lib/api.ts:fetchPitchPhotos selects "name, photo_url" from pitches, and
--     that column does not exist. The select 42703s, the error is swallowed
--     (`if (error) return new Map()`), and every venue silently falls back to
--     a placeholder image. It has never once shown a real photo.
--
--  3. There is no way to say a pitch is indoor or outdoor.
--
-- pitch_name stays denormalized free text and this migration does NOT add a
-- foreign key. Making it one would break every existing game whose
-- pitch_name has no matching row, and the name-match lookup the app already
-- does is enough. The trade is that a typo in pitch_name silently loses the
-- surface -- section 4 gives the operator a view that surfaces exactly that.
-- ============================================================================

-- -- 1. The columns --------------------------------------------------------
alter table public.pitches
  add column if not exists surface   text,
  add column if not exists photo_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pitches_surface_check') then
    -- Null is a first-class value: "the operator has not said yet", which is
    -- the state every pitch starts in and the state the card must render as
    -- no pill at all rather than as a guess.
    alter table public.pitches
      add constraint pitches_surface_check
      check (surface is null or surface in ('indoor', 'outdoor'));
  end if;
end $$;

comment on column public.pitches.surface is
  'indoor | outdoor | null. Null means the operator has not recorded it yet; '
  'the client must omit the pill entirely rather than assume outdoor.';

comment on column public.pitches.photo_url is
  'Public URL or storage path for the venue photo. Read by fetchPitchPhotos, '
  'which matches on name because games.pitch_name is denormalized text.';

-- -- 2. The four real venues ----------------------------------------------
-- Names copied EXACTLY from the distinct games.pitch_name values in use, since
-- the join is a string match and a trailing space would break it silently.
-- surface is left null on purpose: the operator sets it, this migration does
-- not guess it.
insert into public.pitches (id, organiser_id, name)
select
  'pitch-' || lower(regexp_replace(n, '[^a-zA-Z0-9]+', '-', 'g')),
  (select organiser_id from public.games where pitch_name = n order by created_at limit 1),
  n
from (
  select distinct pitch_name as n
    from public.games
   where pitch_name is not null and pitch_name <> ''
) src
where not exists (select 1 from public.pitches p where p.name = src.n)
  and (select organiser_id from public.games where pitch_name = src.n limit 1) is not null;

-- -- 3. Who may write it ---------------------------------------------------
-- 2026-08-lock-down-self-writes.sql established that write access is granted
-- per column, never blanket. Players get nothing here; this is operator data.
revoke update on public.pitches from authenticated;

create or replace function public.set_pitch_surface(
  p_pitch_name text,
  p_surface    text
) returns public.pitches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.pitches;
begin
  if not exists (
    select 1 from public.users u
     where u.id = auth.uid() and u.role in ('operator', 'admin')
  ) then
    raise exception 'not authorised' using errcode = '42501';
  end if;

  if p_surface is not null and p_surface not in ('indoor', 'outdoor') then
    raise exception 'surface must be indoor, outdoor or null' using errcode = '22023';
  end if;

  update public.pitches
     set surface = p_surface
   where name = p_pitch_name
  returning * into v_row;

  -- Not found is an error, not a silent no-op: the caller passed a name that
  -- does not match any pitch row, which is the typo case described above.
  if v_row.id is null then
    raise exception 'no pitch named %', p_pitch_name using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

grant execute on function public.set_pitch_surface(text, text) to authenticated;

-- -- 4. What the operator still has to fill in -----------------------------
-- Every venue players can currently book, and what is missing from it. Also
-- catches the typo case: a pitch_name with no pitches row shows null id.
create or replace view public.pitch_gaps as
  select
    src.n                                   as pitch_name,
    p.id                                    as pitch_id,
    p.surface,
    p.photo_url,
    (select count(*) from public.games g
      where g.pitch_name = src.n and g.status = 'open') as open_games
  from (
    select distinct pitch_name as n from public.games
     where pitch_name is not null and pitch_name <> ''
  ) src
  left join public.pitches p on p.name = src.n;

comment on view public.pitch_gaps is
  'Operator checklist: every venue with games, and whether it has a pitches '
  'row, a surface and a photo yet. A null pitch_id means games.pitch_name '
  'does not match any pitch row -- almost always a typo.';
