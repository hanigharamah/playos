-- Notification preferences and delivery log.
--
-- NOT YET APPLIED.
--
-- Escalated from "limitation" to blocker by the product owner: the forfeit and
-- absence model assumes the player was told before he was penalised. Without
-- this we cannot suppress what he turned off, cannot prove what was sent, and
-- cannot defend a forfeit if he disputes it.
--
-- Three things live here:
--   1. per-channel preferences the reminder function reads before sending
--   2. a record of every send and its result
--   3. a helper the penalty path must consult before charging an absence

begin;

-- ── 1. Preferences ──────────────────────────────────────────────────────────
-- One row per player. Channel names match the toggles in
-- app/account/notifications.tsx exactly; adding a channel here means adding a
-- row to that screen's SECTIONS list and nothing else.
--
-- Transactional messages — booking confirmations, cancellations, refunds — are
-- deliberately NOT represented. They always send and must not be switchable,
-- which is why the screen excludes them from the list rather than showing them
-- disabled.
create table if not exists public.notification_preferences (
  user_id              uuid primary key references public.users(id) on delete cascade,
  match_reminders      boolean not null default true,
  teams_and_check_in   boolean not null default true,
  spot_opened          boolean not null default true,
  head_start           boolean not null default true,
  match_chat           boolean not null default true,
  results_and_awards   boolean not null default true,
  news_and_offers      boolean not null default false,
  updated_at           timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy notif_prefs_own_read on public.notification_preferences
  for select using (user_id = auth.uid() or public.is_operator());

create policy notif_prefs_own_write on public.notification_preferences
  for insert with check (user_id = auth.uid());

create policy notif_prefs_own_update on public.notification_preferences
  for update using (user_id = auth.uid());

-- Every player has preferences from the moment they exist, so the reminder
-- function never has to distinguish "opted out" from "no row yet".
create or replace function public.ensure_notification_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists users_ensure_notif_prefs on public.users;
create trigger users_ensure_notif_prefs
  after insert on public.users
  for each row execute function public.ensure_notification_preferences();

insert into public.notification_preferences (user_id)
  select id from public.users on conflict (user_id) do nothing;

-- ── 2. Delivery log ─────────────────────────────────────────────────────────
-- The evidence. One row per attempted send, whatever the outcome, including
-- sends that were suppressed by preference — "we did not tell him because he
-- turned it off" is exactly the fact a disputed forfeit turns on.
create table if not exists public.notification_deliveries (
  id             bigserial primary key,
  user_id        uuid not null references public.users(id) on delete cascade,
  game_id        text references public.games(id) on delete set null,
  channel        text not null,
  -- What we tried to do and what happened.
  status         text not null check (status in ('sent', 'suppressed_by_pref', 'no_token', 'failed')),
  provider_id    text,
  error          text,
  title          text,
  body           text,
  attempted_at   timestamptz not null default now()
);

create index if not exists notification_deliveries_user_time
  on public.notification_deliveries (user_id, attempted_at desc);

create index if not exists notification_deliveries_game
  on public.notification_deliveries (game_id, channel);

alter table public.notification_deliveries enable row level security;

-- A player can see what we sent them. Operators can see everything, which is
-- what makes a dispute reviewable.
create policy notif_deliveries_own_read on public.notification_deliveries
  for select using (user_id = auth.uid() or public.is_operator());

-- ── 3. The penalty guard ────────────────────────────────────────────────────
-- A player who never granted push, or who turned the relevant channel off,
-- cannot be penalised for missing a message he was never going to get.
-- The absence/forfeit path MUST call this before charging anyone.
create or replace function public.was_notified(
  p_user_id uuid,
  p_game_id text,
  p_channel text
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.notification_deliveries
     where user_id = p_user_id
       and game_id = p_game_id
       and channel = p_channel
       and status = 'sent'
  );
$$;

commit;

-- ── Still to build after this migration ─────────────────────────────────────
-- 1. send-match-reminders must read notification_preferences before sending
--    and write a notification_deliveries row for EVERY outcome, including
--    'suppressed_by_pref'. Today it reads neither table.
-- 2. The forfeit/no-show path must call was_notified() and skip the penalty
--    when it returns false. Until both exist, no absence penalty should be
--    charged at all.
-- 3. Push permission is now requested at first payment rather than at install
--    (see app/checkout/[bookingId].tsx). Opt-in rate should be measured before
--    any absence penalty goes live, per the product owner.
