-- ============================================================================
-- cancel_my_booking threw 42702 on every single call
--
-- `returns table (status text, refunded boolean)` declares an OUT variable
-- named `status`. The last statement in the body was:
--
--   update public.games set status = 'open'
--    where id = b.game_id and status = 'full';
--
-- `status` in that WHERE is ambiguous between the OUT variable and
-- games.status, so PL/pgSQL raises
--   42702: column reference "status" is ambiguous
-- and the whole function aborts — rolling back the booking UPDATE that had
-- already run. Cancelling a booking has never worked.
--
-- This is the "I tried cancelling a game, couldn't cancel" the owner reported.
-- Commit c95e4c9 fixed the CLIENT half (it was discarding the RPC's returned
-- rows and reporting refusals as success) and this survived underneath it,
-- because the client fix made the failure surface as a thrown error rather
-- than a silent success — which looks like a network problem, not a bug in a
-- function nobody had executed.
--
-- Found by accident while regression-testing the grant lockdown. Nothing had
-- ever CALLED this function in a test; it was only ever read.
-- ============================================================================

create or replace function public.cancel_my_booking(p_booking_id text)
returns table (status text, refunded boolean)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  b            record;
  v_kickoff    timestamptz;
  v_free_hours int := 26;   -- keep in sync with FREE_CANCEL_HOURS in lib/api.ts
  v_eligible   boolean;
begin
  select bk.*, g.kickoff_time
    into b
    from public.bookings bk
    join public.games g on g.id = bk.game_id
   where bk.id = p_booking_id
     and bk.user_id = auth.uid();

  if not found then
    return query select 'not_found'::text, false;
    return;
  end if;
  if b.payment_status in ('refunded', 'forfeited') then
    return query select 'already_cancelled'::text, false;
    return;
  end if;

  v_kickoff  := b.kickoff_time;
  v_eligible := v_kickoff - now() > (v_free_hours || ' hours')::interval;

  update public.bookings
     set payment_status  = case when v_eligible then 'refunded' else 'forfeited' end,
         hold_expires_at = null
   where id = p_booking_id;

  -- ALIASED. `g.status` cannot be confused with the OUT variable of the same
  -- name; the unqualified form is what raised 42702 on every call.
  update public.games g
     set status = 'open'
   where g.id = b.game_id
     and g.status = 'full';

  return query select 'ok'::text, v_eligible;
end;
$function$;

grant execute on function public.cancel_my_booking(text) to authenticated;
