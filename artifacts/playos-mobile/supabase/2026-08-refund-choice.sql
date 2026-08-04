-- ============================================================================
-- Make the refund choice savable
--
-- 2026-07-operator-surface.sql created refund_choices and cancel_match, then
-- listed what it deliberately did NOT build. Two of those items are why the
-- player currently gets an error on the refund screen:
--
--   * nothing let the player write their choice;
--   * "token" needs a 30-day expiry, and users.credits is a bare integer with
--     no issue date, no expiry and no audit trail -- incrementing it would
--     mint money that never expires.
--
-- This builds both. The 48-hour auto-cash sweep is section 4; it still needs a
-- scheduler to call it, and until one exists an unchosen refund simply stays
-- unchosen rather than silently defaulting to a token.
-- ============================================================================

begin;

-- -- 1. A token ledger, not a counter ----------------------------------------
-- One row per issued token, because a balance cannot express an expiry. Every
-- token knows what cancellation it came from, when it was issued, when it dies
-- and whether it has been spent -- which is the minimum needed to answer "why
-- do I have 30 riyals" and "why did it disappear".
create table if not exists public.credit_tokens (
  id           bigserial primary key,
  user_id      uuid not null references public.users(id) on delete cascade,
  amount       numeric not null check (amount > 0),
  -- Where it came from. Null once the booking is deleted, which is why this is
  -- not the primary key: the token outlives its origin.
  booking_id   text references public.bookings(id) on delete set null,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  consumed_at  timestamptz,
  consumed_on  text references public.games(id) on delete set null
);

create index if not exists credit_tokens_user_live
  on public.credit_tokens (user_id, expires_at)
  where consumed_at is null;

alter table public.credit_tokens enable row level security;

-- Read-only to the player. Issuing and spending both go through SECURITY
-- DEFINER functions -- this is a wallet, and a client that can write to it
-- can mint money.
drop policy if exists credit_tokens_own on public.credit_tokens;
create policy credit_tokens_own on public.credit_tokens
  for select using (user_id = auth.uid() or public.is_operator());

revoke insert, update, delete on public.credit_tokens from authenticated;

comment on table public.credit_tokens is
  'Issued game tokens, one row each. A ledger rather than a balance because a '
  'balance cannot carry an expiry date. Never written from the client.';

-- -- 2. How long a token lives -----------------------------------------------
-- 30 days, per the ratified policy in 2026-07-operator-surface.sql. The Figma
-- copy on "Refund 1 - Match cancelled" says 60 and is stale; the number lives
-- here so the app and the DB cannot disagree about it.
create or replace function public.token_expiry_days()
returns int language sql immutable as $$ select 30 $$;

-- -- 3. The player's choice --------------------------------------------------
create or replace function public.choose_refund(
  p_booking_id text,
  p_choice     text
) returns public.refund_choices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.refund_choices%rowtype;
begin
  if p_choice not in ('cash', 'token') then
    raise exception 'choice must be cash or token, got %', p_choice using errcode = '22023';
  end if;

  -- Locked: without this, two taps in flight both read choice as null and the
  -- second overwrites the first -- and if the first issued a token, section 3
  -- below would issue a second one for the same cancellation.
  select * into v_row from public.refund_choices where booking_id = p_booking_id for update;

  if not found then
    raise exception 'no refund pending for booking %', p_booking_id using errcode = 'P0002';
  end if;
  if v_row.user_id <> auth.uid() then
    raise exception 'not your refund' using errcode = '42501';
  end if;
  if v_row.settled_at is not null then
    raise exception 'this refund has already been settled' using errcode = '55000';
  end if;
  -- The deadline is enforced here, not in the client. A device clock the
  -- player controls must not decide whether a 48h window is still open.
  if now() > v_row.decide_by then
    raise exception 'the 48 hour window closed on %', v_row.decide_by using errcode = '55000';
  end if;

  update public.refund_choices
     set choice = p_choice, chosen_at = now()
   where booking_id = p_booking_id
  returning * into v_row;

  -- A token is issued immediately, because the player asked for it and the
  -- expiry runs from issue. Cash is NOT settled here: moving real money is the
  -- operator's job, and settled_at stays null so it shows on their list.
  if p_choice = 'token' then
    insert into public.credit_tokens (user_id, amount, booking_id, expires_at)
    values (v_row.user_id, v_row.amount, v_row.booking_id,
            now() + (public.token_expiry_days() || ' days')::interval);

    update public.refund_choices
       set settled_at = now()
     where booking_id = p_booking_id
    returning * into v_row;

    update public.bookings
       set payment_status = 'refunded'
     where id = p_booking_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.choose_refund(text, text) to authenticated;

-- -- 4. The 48-hour sweep ----------------------------------------------------
-- Settles every expired undecided refund as CASH. It must never default a
-- player into a token: a token is a thing they have to come back and spend,
-- and choosing that on their behalf because they did not reply is not a
-- refund. Returns how many it settled so a scheduler can log it.
--
-- NOT SCHEDULED YET. Nothing calls this; until something does, an unchosen
-- refund stays unchosen, which is visible rather than wrong.
create or replace function public.sweep_expired_refunds()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.refund_choices
     set choice = 'cash', settled_at = now()
   where choice is null
     and settled_at is null
     and now() > decide_by;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- -- 5. What the player is owed ----------------------------------------------
create or replace function public.my_live_tokens()
returns table (total numeric, soonest_expiry timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::numeric, min(expires_at)
    from public.credit_tokens
   where user_id = auth.uid()
     and consumed_at is null
     and expires_at > now();
$$;

grant execute on function public.my_live_tokens() to authenticated;

commit;
