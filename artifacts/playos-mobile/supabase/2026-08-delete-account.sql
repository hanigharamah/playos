-- ============================================================================
-- Let a player delete their own account
--
-- Apple requires any app that creates accounts to offer in-app deletion
-- (App Store Review Guideline 5.1.1(v)). There was no path at all, which is an
-- automatic rejection.
--
-- A naive `delete from auth.users` is NOT safe here. The foreign keys say why:
--
--   games.organiser_id    CASCADE   -> deleting an organiser deletes every
--   pitches.organiser_id  CASCADE      game and pitch they created, and every
--                                      OTHER player's bookings on them
--   ops_audit_log         NO ACTION -> deletion hard-fails for anyone who has
--                                      ever acted as an operator
--
-- So this refuses for organisers and clears the audit link first. Everything
-- else -- bookings, refund_choices, credit_tokens, login_events -- cascades,
-- which is what "delete my data" should mean.
-- ============================================================================

begin;

create or replace function public.delete_my_account()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_games     int;
  v_owed      numeric;
  v_tokens    numeric;
begin
  if v_uid is null then
    return 'not_authenticated';
  end if;

  -- An organiser's account cannot be deleted from the app, because the cascade
  -- would take the catalogue with it: their games, their pitches, and every
  -- booking any other player holds on them. This is not a player-facing case
  -- -- organisers are staff -- and the client tells them to contact support
  -- rather than pretending the button is broken.
  select count(*) into v_games from public.games where organiser_id = v_uid;
  if v_games > 0 then
    return 'is_organiser';
  end if;

  -- Money still owed. Deleting would cascade the refund row away and silently
  -- cancel a debt the player is owed, so this stops and lets them collect it
  -- first. Reported separately from a hard failure: it is a "settle this
  -- first", not an error.
  select coalesce(sum(amount), 0) into v_owed
    from public.refund_choices where user_id = v_uid and settled_at is null;
  select coalesce(sum(amount), 0) into v_tokens
    from public.credit_tokens
   where user_id = v_uid and consumed_at is null and expires_at > now();
  if v_owed > 0 or v_tokens > 0 then
    return 'has_balance';
  end if;

  -- The audit log outlives the account on purpose: it records what an operator
  -- DID, and losing that would defeat the point of having it. The link to the
  -- person is cleared instead, which is what deletion actually requires.
  update public.ops_audit_log set actor_user_id = null where actor_user_id = v_uid;

  -- Future seats are freed by the cascade removing the booking rows, so no
  -- separate release is needed -- get_game_seatmap counts rows, not statuses.

  delete from auth.users where id = v_uid;

  return 'ok';
end;
$$;

grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Self-service account deletion for App Store Guideline 5.1.1(v). Returns ok, '
  'not_authenticated, is_organiser (cascade would destroy the game catalogue) '
  'or has_balance (an unsettled refund or a live token would be silently '
  'cancelled). Cascades bookings, refund_choices, credit_tokens and '
  'login_events; nulls the ops_audit_log actor rather than losing the record.';

commit;
