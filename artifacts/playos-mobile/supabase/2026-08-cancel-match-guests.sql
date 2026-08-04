-- ============================================================================
-- cancel_match must not die on a guest booking, and one role check was wrong
--
-- 1. bookings.user_id is NULLABLE -- there is a live booking in the database
--    with no account behind it. cancel_match inserts b.user_id straight into
--    refund_choices.user_id, which is NOT NULL, so cancelling any game with a
--    guest booking raises 23502 and the whole function rolls back: the game
--    is NOT cancelled, no refunds are created, and the operator is told
--    nothing useful. Found by executing it, not by reading it.
--
--    Guest bookings are skipped rather than accommodated. A refund_choices row
--    exists so a player can open the app and choose; someone with no account
--    has nowhere to make that choice, and the operator has to reach them by
--    phone regardless. Silently dropping them would be worse, so the count the
--    function returns now distinguishes the two.
--
-- 2. set_pitch_surface (2026-08-pitch-surface.sql) checked
--    role in ('operator','admin'). There is no 'operator' role -- the roles in
--    use are 'player' and 'admin', and is_operator() accepts
--    ('admin','organiser','host'). Two different definitions of the same
--    permission is how one of them ends up wrong; it now calls is_operator().
-- ============================================================================

begin;

create or replace function public.cancel_match(
  p_game_id text,
  p_reason text
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_guests integer;
begin
  if not public.is_operator() then
    raise exception 'not an operator';
  end if;
  if p_reason not in ('venue_closed', 'weather', 'not_enough_players') then
    raise exception 'unknown cancellation reason: %', p_reason;
  end if;

  update public.games
     set status = 'cancelled', cancelled_reason = p_reason, cancelled_at = now()
   where id = p_game_id;

  insert into public.refund_choices (booking_id, game_id, user_id, amount)
  select b.id, b.game_id, b.user_id, g.price
    from public.bookings b
    join public.games g on g.id = b.game_id
   where b.game_id = p_game_id
     and b.payment_status not in ('refunded', 'forfeited')
     and b.user_id is not null          -- see note 1
  on conflict (booking_id) do nothing;

  get diagnostics v_count = row_count;

  -- Counted and logged, never silently dropped: these are people who paid and
  -- whom the operator now has to call.
  select count(*) into v_guests
    from public.bookings b
   where b.game_id = p_game_id
     and b.payment_status not in ('refunded', 'forfeited')
     and b.user_id is null;

  insert into public.ops_audit_log (actor_user_id, operator_initial, action, game_id, detail)
  values (auth.uid(), 'SYS', 'cancel_match', p_game_id,
          jsonb_build_object('reason', p_reason, 'players', v_count, 'guests_to_call', v_guests));

  return v_count;
end;
$$;

create or replace function public.set_pitch_surface(
  p_pitch_name text,
  p_surface    text
) returns public.pitches
language plpgsql security definer set search_path = public as $$
declare
  v_row public.pitches;
begin
  if not public.is_operator() then
    raise exception 'not authorised' using errcode = '42501';
  end if;
  if p_surface is not null and p_surface not in ('indoor', 'outdoor') then
    raise exception 'surface must be indoor, outdoor or null' using errcode = '22023';
  end if;

  update public.pitches set surface = p_surface where name = p_pitch_name
  returning * into v_row;

  if v_row.id is null then
    raise exception 'no pitch named %', p_pitch_name using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

commit;
