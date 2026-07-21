-- ============================================================================
-- PlayOS mobile v3 redesign — backend for the "activity" screen (XP/streak/
-- level) and the "great game!" post-match stats screen.
-- Run in Supabase SQL editor. Safe to run more than once.
--
-- Design choice: XP, streak, and level are COMPUTED from real check-in
-- history (games_played, checked_in_at), not stored as separately-mutable
-- columns. Storing them separately risks them drifting out of sync with
-- the actual booking data (e.g., a cancelled booking should reduce XP, but
-- a stored counter could easily be forgotten in that code path). Computing
-- them live from bookings.checked_in_at means they're always correct by
-- construction — the "activity" screen literally cannot show fake progress.
--
-- Post-match stats (goals/assists/distance/rating) genuinely cannot be
-- derived from anything existing — there is no referee/stats system, so
-- this is real new data, self-submitted by the player after their game.
-- ============================================================================

-- ── Post-match self-reported stats ──────────────────────────────────────────
create table if not exists public.game_player_stats (
  game_id       uuid not null references public.games(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  goals         smallint not null default 0 check (goals >= 0),
  assists       smallint not null default 0 check (assists >= 0),
  distance_km   numeric(4,2) check (distance_km >= 0),
  rating        smallint check (rating between 1 and 10),
  submitted_at  timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table public.game_player_stats enable row level security;

drop policy if exists "game_player_stats: read own" on public.game_player_stats;
create policy "game_player_stats: read own"
  on public.game_player_stats for select
  using (user_id = auth.uid());

-- A player may only submit stats for a game they were actually checked in
-- to (no self-reporting goals for a game you didn't attend), and only in
-- the 24h window AFTER THE MATCH ENDS (kickoff_time + duration_minutes) —
-- not after kickoff, which would let stats be submitted mid-game before
-- it's even finished.
drop policy if exists "game_player_stats: submit own, checked-in, within 24h" on public.game_player_stats;
create policy "game_player_stats: submit own, checked-in, within 24h"
  on public.game_player_stats for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      join public.games g on g.id = b.game_id
      where b.game_id = game_player_stats.game_id
        and b.user_id = auth.uid()
        and b.checked_in = true
        and g.kickoff_time + (g.duration_minutes || ' minutes')::interval <= now()
        and g.kickoff_time + (g.duration_minutes || ' minutes')::interval >= now() - interval '24 hours'
    )
  );

drop policy if exists "game_player_stats: update own within window" on public.game_player_stats;
create policy "game_player_stats: update own within window"
  on public.game_player_stats for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.games g
      where g.id = game_player_stats.game_id
        and g.kickoff_time + (g.duration_minutes || ' minutes')::interval >= now() - interval '24 hours'
    )
  );

-- ── Activity: XP, level, streak, weekly progress — all computed live ───────
-- XP: 100 per checked-in game, +20 per goal, +10 per assist (self-reported,
-- so treat as a fun bonus, not a leaderboard-integrity-critical number).
-- Level: 250 XP per level, level = floor(xp/250) + 1.
-- Streak: consecutive days (not games) with at least one checked-in game,
-- counting back from today.
create or replace function public.get_my_activity()
returns table (
  xp integer,
  level integer,
  xp_into_level integer,
  xp_for_next_level integer,
  current_streak_days integer,
  longest_streak_days integer,
  matches_this_week integer,
  week_days_played boolean[]  -- Mon..Sun, this week, whether the player had a checked-in game that day
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_xp integer;
  v_level integer;
  v_checkin_dates date[];
  v_current_streak integer := 0;
  v_longest_streak integer := 0;
  v_run integer := 0;
  v_prev date;
  v_d date;
  v_week_start date := date_trunc('week', now())::date; -- Monday
  v_week_days boolean[] := array[false, false, false, false, false, false, false];
  v_this_week_count integer;
begin
  select
    coalesce(count(*) filter (where b.checked_in), 0) * 100
    + coalesce(sum(coalesce(s.goals, 0)), 0) * 20
    + coalesce(sum(coalesce(s.assists, 0)), 0) * 10
  into v_xp
  from public.bookings b
  left join public.game_player_stats s on s.game_id = b.game_id and s.user_id = b.user_id
  where b.user_id = auth.uid() and b.payment_status = 'paid';

  v_xp := coalesce(v_xp, 0);
  v_level := (v_xp / 250) + 1;

  select array_agg(distinct (b.checked_in_at at time zone 'UTC')::date order by (b.checked_in_at at time zone 'UTC')::date)
  into v_checkin_dates
  from public.bookings b
  where b.user_id = auth.uid() and b.checked_in = true and b.checked_in_at is not null;

  if v_checkin_dates is not null then
    foreach v_d in array v_checkin_dates loop
      if v_prev is null or v_d = v_prev + 1 then
        v_run := v_run + 1;
      else
        v_run := 1;
      end if;
      v_longest_streak := greatest(v_longest_streak, v_run);
      v_prev := v_d;
    end loop;

    -- Current streak only counts if it reaches up to today or yesterday
    -- (a streak "ends" once a day is missed).
    if v_prev >= (now() at time zone 'UTC')::date - 1 then
      v_current_streak := v_run;
    end if;
  end if;

  select count(distinct b.game_id) into v_this_week_count
  from public.bookings b
  join public.games g on g.id = b.game_id
  where b.user_id = auth.uid() and b.checked_in = true
    and g.kickoff_time >= v_week_start and g.kickoff_time < v_week_start + 7;

  for i in 0..6 loop
    v_week_days[i + 1] := exists (
      select 1 from public.bookings b
      join public.games g on g.id = b.game_id
      where b.user_id = auth.uid() and b.checked_in = true
        and (g.kickoff_time at time zone 'UTC')::date = v_week_start + i
    );
  end loop;

  return query select
    v_xp,
    v_level,
    v_xp % 250,
    250,
    v_current_streak,
    v_longest_streak,
    coalesce(v_this_week_count, 0),
    v_week_days;
end;
$$;

grant execute on function public.get_my_activity() to authenticated;

-- ── Report ───────────────────────────────────────────────────────────────────
select 'game_player_stats table' as item, count(*) as ok
  from information_schema.tables where table_name = 'game_player_stats'
union all
select 'get_my_activity() fn', count(*)
  from information_schema.routines where routine_name = 'get_my_activity';
