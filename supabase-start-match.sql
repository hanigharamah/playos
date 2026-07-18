-- ============================================================================
-- PlayOS — start_match RPC: balance unpicked players + guests, then flip
-- Supersedes lock_teams_and_flip (which assumed both sides were already full).
-- Run in Supabase SQL editor. Safe to run more than once.
-- ============================================================================

-- Returns: 'ok' | 'already_locked' | 'not_found' | 'too_few'
create or replace function public.start_match(
  p_game_id text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity     int;
  v_locked       boolean;
  v_checked_in   int;
  v_yellow_count int;
  v_purple_count int;
  v_next_yellow  int;
  v_next_purple  int;
  r record;
  v_target       smallint;
begin
  select capacity, (kickoff_team is not null)
    into v_capacity, v_locked
    from games where id = p_game_id;

  if v_capacity is null then return 'not_found'; end if;
  if v_locked then return 'already_locked'; end if;

  select count(*) into v_checked_in
    from bookings
   where game_id = p_game_id
     and checked_in = true
     and payment_status in ('paid', 'pending');

  if v_checked_in < 4 then return 'too_few'; end if;

  -- Current picked counts (checked-in only)
  select count(*) filter (where team = 1), count(*) filter (where team = 2)
    into v_yellow_count, v_purple_count
    from bookings
   where game_id = p_game_id
     and checked_in = true
     and payment_status in ('paid', 'pending');

  select coalesce(max(slot_index) filter (where team = 1), -1) + 1,
         coalesce(max(slot_index) filter (where team = 2), -1) + 1
    into v_next_yellow, v_next_purple
    from bookings
   where game_id = p_game_id
     and payment_status in ('paid', 'pending');

  -- Distribute every checked-in booking with team is null onto whichever
  -- side currently has fewer, alternating as we go.
  for r in
    select id from bookings
     where game_id = p_game_id
       and checked_in = true
       and payment_status in ('paid', 'pending')
       and team is null
     order by checked_in_at asc nulls last, id asc
  loop
    if v_yellow_count <= v_purple_count then
      v_target := 1;
      update bookings set team = 1, slot_index = v_next_yellow where id = r.id;
      v_next_yellow := v_next_yellow + 1;
      v_yellow_count := v_yellow_count + 1;
    else
      v_target := 2;
      update bookings set team = 2, slot_index = v_next_purple where id = r.id;
      v_next_purple := v_next_purple + 1;
      v_purple_count := v_purple_count + 1;
    end if;
  end loop;

  update games
     set kickoff_team    = (floor(random() * 2) + 1)::smallint,
         teams_locked_at = now()
   where id = p_game_id
     and kickoff_team is null;

  return 'ok';
end;
$$;

-- ── Report ───────────────────────────────────────────────────────────────────
select 'start_match rpc' as item, count(*) as ok from pg_proc where proname = 'start_match';
