-- Operator surface — backing for Ops · At-risk players T-10 (Figma 685:502)
-- and Ops · Cancel match (685:596).
--
-- NOT YET APPLIED. The two screens are built and call these RPCs; until this
-- runs they surface the failure rather than reporting work that never happened.
--
-- Depends on 2026-07-booking-integrity.sql for the 'forfeited' status.

begin;

-- ── Who counts as an operator ───────────────────────────────────────────────
create or replace function public.is_operator()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role in ('admin', 'organiser', 'host')
  );
$$;

-- ── Attribution ─────────────────────────────────────────────────────────────
-- A single shared admin login means auth.uid() cannot tell us WHO acted, so
-- the operator types an initial at entry and every action records it. Without
-- this there is no way to review a disputed release or cancellation.
create table if not exists public.ops_audit_log (
  id                bigserial primary key,
  acted_at          timestamptz not null default now(),
  actor_user_id     uuid references public.users(id),
  operator_initial  text not null,
  action            text not null,
  game_id           text references public.games(id),
  booking_id        text references public.bookings(id),
  detail            jsonb,
  constraint ops_audit_log_action_check
    check (action in ('release_spot', 'cancel_match'))
);

alter table public.ops_audit_log enable row level security;

create policy ops_audit_log_operator_read on public.ops_audit_log
  for select using (public.is_operator());

-- ── The at-risk list needs player phone numbers ─────────────────────────────
-- Players must never read each other's numbers; operators must.
create policy users_operator_read on public.users
  for select using (public.is_operator());

create policy bookings_operator_read on public.bookings
  for select using (public.is_operator());

-- ── release_spot ────────────────────────────────────────────────────────────
-- A no-show's spot at T-10. Forfeits the money and frees the slot.
create or replace function public.release_spot(
  p_booking_id text,
  p_operator_initial text
) returns text language plpgsql security definer set search_path = public as $$
declare
  v_booking public.bookings%rowtype;
begin
  if not public.is_operator() then return 'forbidden'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then return 'not_found'; end if;
  if v_booking.payment_status in ('refunded', 'forfeited') then return 'already_released'; end if;

  update public.bookings set payment_status = 'forfeited' where id = p_booking_id;
  update public.games set status = 'open' where id = v_booking.game_id and status = 'full';

  insert into public.ops_audit_log (actor_user_id, operator_initial, action, game_id, booking_id, detail)
  values (auth.uid(), p_operator_initial, 'release_spot', v_booking.game_id, p_booking_id,
          jsonb_build_object('previous_status', v_booking.payment_status));

  return 'ok';
end;
$$;

-- ── cancel_match ────────────────────────────────────────────────────────────
-- PlayOS or venue cancellation. Ratified policy:
--   * refund defaults to CASH, never a token
--   * the player may choose a game token instead, within 48 hours
--   * after 48h with no choice we auto-refund cash
--   * streak is preserved either way, it counts as a played week
--   * no XP either way, no game was played
--   * game tokens expire 30 days after issue
--
-- Requires a refund_choice row per booking so the player-facing screens have
-- somewhere to write the choice and the 48h job has something to sweep.
create table if not exists public.refund_choices (
  booking_id   text primary key references public.bookings(id) on delete cascade,
  game_id      text not null references public.games(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  amount       numeric not null,
  choice       text check (choice in ('cash', 'token')),
  chosen_at    timestamptz,
  -- Deadline is stamped server-side; the device clock is not trusted.
  decide_by    timestamptz not null default now() + interval '48 hours',
  settled_at   timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.refund_choices enable row level security;

create policy refund_choices_own on public.refund_choices
  for select using (user_id = auth.uid() or public.is_operator());

create policy refund_choices_own_update on public.refund_choices
  for update using (user_id = auth.uid() and settled_at is null);

create or replace function public.cancel_match(
  p_game_id text,
  p_reason text
) returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
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
  on conflict (booking_id) do nothing;

  get diagnostics v_count = row_count;

  insert into public.ops_audit_log (actor_user_id, operator_initial, action, game_id, detail)
  values (auth.uid(), 'SYS', 'cancel_match', p_game_id,
          jsonb_build_object('reason', p_reason, 'players', v_count));

  return v_count;
end;
$$;

-- Columns the cancellation writes.
alter table public.games add column if not exists cancelled_reason text;
alter table public.games add column if not exists cancelled_at timestamptz;

commit;

-- ── Still to build after this migration ─────────────────────────────────────
-- 1. The 48-hour sweep: a scheduled job that settles every refund_choices row
--    where choice is null and decide_by has passed, as CASH. It must never
--    default a player into a token.
-- 2. Token issuance with a 30-day expiry (NOT 60 — the Figma copy on
--    "Refund 1 · Match cancelled" is stale and needs correcting at source).
-- 3. Auto-cancel at T-10 when fewer than 10 of 12 are checked in, which should
--    call cancel_match with 'not_enough_players'.
-- 4. Streak preservation: a cancelled match must count as a played week while
--    awarding no XP. get_my_activity() currently derives both from checked-in
--    bookings, so it needs to read cancelled games separately.
