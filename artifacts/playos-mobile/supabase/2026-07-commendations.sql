-- ─────────────────────────────────────────────────────────────────────────────
-- Commendations + reports (sportsmanship v1 — "ship the feeling, defer the
-- number"). Run in the Supabase SQL editor.
--
-- Decisions (see FIGMA-MAP.md / 📐 Handoff):
--   • Positive-only peer commendations, max 3 per rater per game, opponents
--     included, 24h window after kickoff, rater must have checked in.
--   • Each commendation received = +5 XP (wired into get_my_activity).
--   • Reports are a private safety valve: written via RPC, readable only by
--     ops (service role) — never affect any score in v1.
--   • No sportsmanship score anywhere in v1; computed retroactively in v1.5.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Commendations ────────────────────────────────────────────────────────────

create table if not exists public.player_commendations (
  game_id     text not null references public.games(id) on delete cascade,
  rater_id    uuid not null references auth.users(id) on delete cascade,
  rated_id    uuid not null references auth.users(id) on delete cascade,
  tag         text not null check (tag in ('fair_play', 'great_teammate', 'good_vibes')),
  created_at  timestamptz not null default now(),
  primary key (game_id, rater_id, rated_id),
  check (rater_id <> rated_id)
);

alter table public.player_commendations enable row level security;

-- Badge counts are public-profile data: any signed-in user may read
-- (Player Profile shows other players' badges). Writes go through the RPC
-- only — no insert/update/delete policies.
drop policy if exists "commendations: authenticated read" on public.player_commendations;
create policy "commendations: authenticated read"
  on public.player_commendations for select
  to authenticated
  using (true);

-- Race-safe commend RPC. Validates everything server-side so the client can
-- stay dumb; mirrors the claim_side pattern.
create or replace function public.commend_player(
  p_game_id text,
  p_rated_id uuid,
  p_tag text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kickoff timestamptz;
  v_checked_in boolean;
  v_rated_booked boolean;
  v_given integer;
begin
  if auth.uid() is null then
    return 'not_authenticated';
  end if;
  if p_rated_id = auth.uid() then
    return 'cannot_commend_self';
  end if;
  if p_tag not in ('fair_play', 'great_teammate', 'good_vibes') then
    return 'invalid_tag';
  end if;

  select kickoff_time into v_kickoff from games where id = p_game_id;
  if v_kickoff is null then
    return 'game_not_found';
  end if;
  -- Window: from kickoff until 24h after kickoff.
  if now() < v_kickoff or now() > v_kickoff + interval '24 hours' then
    return 'outside_window';
  end if;

  -- Rater must have a paid, checked-in booking for this game.
  select coalesce(bool_or(checked_in), false) into v_checked_in
  from bookings
  where game_id = p_game_id and user_id = auth.uid() and payment_status = 'paid';
  if not v_checked_in then
    return 'not_checked_in';
  end if;

  -- Rated player must have a paid booking for this game.
  select exists (
    select 1 from bookings
    where game_id = p_game_id and user_id = p_rated_id and payment_status = 'paid'
  ) into v_rated_booked;
  if not v_rated_booked then
    return 'player_not_in_game';
  end if;

  -- Max 3 commendations per rater per game (PK already enforces one per
  -- rated player; this caps distinct players).
  select count(*) into v_given
  from player_commendations
  where game_id = p_game_id and rater_id = auth.uid();
  if v_given >= 3 then
    return 'limit_reached';
  end if;

  insert into player_commendations (game_id, rater_id, rated_id, tag)
  values (p_game_id, auth.uid(), p_rated_id, p_tag)
  on conflict (game_id, rater_id, rated_id) do nothing;

  return 'ok';
end;
$$;

grant execute on function public.commend_player(text, uuid, text) to authenticated;

-- Badge counts for a profile (own or another player's public card).
create or replace function public.get_player_badges(p_user_id uuid)
returns table (tag text, count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select tag, count(*)
  from player_commendations
  where rated_id = p_user_id
  group by tag;
$$;

grant execute on function public.get_player_badges(uuid) to authenticated;

-- ── Reports (private safety valve) ───────────────────────────────────────────

create table if not exists public.player_reports (
  id           uuid primary key default gen_random_uuid(),
  game_id      text not null references public.games(id) on delete cascade,
  reporter_id  uuid not null references auth.users(id) on delete cascade,
  reported_id  uuid not null references auth.users(id) on delete cascade,
  category     text not null check (category in ('aggression', 'harassment', 'other')),
  note         text check (char_length(note) <= 1000),
  status       text not null default 'pending' check (status in ('pending', 'confirmed', 'dismissed')),
  created_at   timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

alter table public.player_reports enable row level security;
-- No user-facing policies at all: users write via the RPC below; only the
-- service role (ops) reads or updates.

create or replace function public.report_player(
  p_game_id text,
  p_reported_id uuid,
  p_category text,
  p_note text default null
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_same_game boolean;
begin
  if auth.uid() is null then
    return 'not_authenticated';
  end if;
  if p_reported_id = auth.uid() then
    return 'cannot_report_self';
  end if;
  if p_category not in ('aggression', 'harassment', 'other') then
    return 'invalid_category';
  end if;

  -- Both parties must have paid bookings in the same game.
  select
    exists (select 1 from bookings where game_id = p_game_id and user_id = auth.uid() and payment_status = 'paid')
    and exists (select 1 from bookings where game_id = p_game_id and user_id = p_reported_id and payment_status = 'paid')
  into v_same_game;
  if not v_same_game then
    return 'not_same_game';
  end if;

  insert into player_reports (game_id, reporter_id, reported_id, category, note)
  values (p_game_id, auth.uid(), p_reported_id, p_category, p_note);

  return 'ok';
end;
$$;

grant execute on function public.report_player(text, uuid, text, text) to authenticated;

-- ── XP: +5 per commendation received ────────────────────────────────────────
-- get_my_activity's formula (in 2026-07-activity-and-stats.sql) now includes
-- "+ commendations received ×5". Run THIS file first, then re-run that one so
-- the updated function picks up the new table.
