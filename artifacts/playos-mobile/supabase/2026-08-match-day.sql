-- Match day — the two things the mini-bar and check-in need.
--
-- NOT YET APPLIED. Small and self-contained; depends on
-- 2026-07-booking-integrity.sql for the 'forfeited' status.
--
-- Ratified 3 Aug 2026:
--   * check-in is bound to the CLOCK, never to a place — no geofence, and the
--     button is never gated on location
--   * no auto-anything: the operator calls at T-10 and marks a no-show by hand
--   * missing check-in costs the full fee and releases the spot to a sub
--   * the T-12h reconfirm ask carries no money consequence at all

begin;

-- ── 1. The T-12h reconfirm flag ─────────────────────────────────────────────
-- Purely so mini-bar state 1 can disappear once the player answers. Nothing
-- financial hangs off it: ignoring the ask costs nothing and keeps the spot.
alter table public.bookings
  add column if not exists reconfirmed_at timestamptz;

comment on column public.bookings.reconfirmed_at is
  'When the player answered the T-12h "still coming tonight?" ask. Null means '
  'unanswered. Carries NO money consequence — it only silences the ask.';

-- ── 2. Self check-in ────────────────────────────────────────────────────────
-- The web app checks players in by scanning a pitch QR (check_in_by_pitch).
-- That is superseded: check-in is now a tap in the app, inside the T-20 window.
-- Nothing in the mobile client could write checked_in at all before this.
--
-- The window is enforced HERE, not on the device, for the same reason the
-- refund cutoff should be: a phone's clock is not evidence.
create or replace function public.check_in(p_game_id text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
  v_kickoff timestamptz;
  v_opens   timestamptz;
begin
  select g.kickoff_time into v_kickoff from public.games g where g.id = p_game_id;
  if v_kickoff is null then return 'not_found'; end if;

  select * into v_booking
    from public.bookings
   where game_id = p_game_id
     and user_id = auth.uid()
     and payment_status not in ('refunded', 'forfeited')
   limit 1;
  if not found then return 'no_booking'; end if;

  if v_booking.checked_in then return 'already_checked_in'; end if;

  -- Opens 20 minutes before kickoff. Closes at kickoff: after that the roster
  -- is frozen and a late arrival is the operator's call, not a self-service one.
  v_opens := v_kickoff - interval '20 minutes';
  if now() < v_opens  then return 'too_early'; end if;
  if now() > v_kickoff then return 'too_late';  end if;

  update public.bookings set checked_in = true where id = v_booking.id;
  return 'ok';
end;
$$;

commit;

-- ── Still to decide ─────────────────────────────────────────────────────────
-- 1. HALF-PRICE SUBS. The handoff says a sub books and pays half for the shirt
--    he is covering. Price currently comes off the game, so every booking is
--    full price. This needs either a price override on bookings or a discount
--    on the booking path — and a way to record which shirt is being covered.
--    Not built: it is a pricing decision, not an implementation detail.
--
-- 2. MARKING THE NO-SHOW. A player still unchecked at T-10 must move to
--    'forfeited' so the seat frees for the sub. With no auto-anything, that is
--    the operator's `release_spot` action on the at-risk screen — which lives
--    in 2026-07-operator-surface.sql. That migration is therefore no longer
--    optional: it is the only mechanism that marks a no-show.
