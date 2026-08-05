-- ============================================================================
-- Per-message notification preferences
--
-- The screen (app/account/notifications.tsx) and both hooks in lib/api.ts have
-- existed for weeks and degrade gracefully when the table is missing: they
-- fall back to AsyncStorage and report synced:false. So a player could toggle
-- switches, see them stick on that device, and have the choice mean nothing —
-- reinstall and it is gone, and the sender never saw it at all.
--
-- 2026-07-notification-preferences.sql was never applied. This replaces it,
-- matching the column names lib/api.ts already reads and writes rather than
-- asking the client to change.
--
-- Only the T-20 match reminder is actually sent today (send-match-reminders).
-- The other six rows are switches for notifications that do not exist yet;
-- they are stored so the choice survives, and honoured as each sender is
-- built. Storing a preference nobody consults is better than losing it: the
-- alternative is asking every player again later.
-- ============================================================================

begin;

create table if not exists public.notification_preferences (
  user_id             uuid primary key references public.users(id) on delete cascade,
  match_reminders     boolean not null default true,
  teams_and_check_in  boolean not null default true,
  spot_opened         boolean not null default true,
  head_start          boolean not null default true,
  match_chat          boolean not null default true,
  results_and_awards  boolean not null default true,
  -- The one default-off: marketing is opt-IN. Defaulting it on and relying on
  -- people to find this screen is how an app earns a spam reputation, and in
  -- several jurisdictions it is not lawful either.
  news_and_offers     boolean not null default false,
  updated_at          timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- Self-only, plus operators. An operator does not need to read these to send
-- the T-20 reminder — that runs as service_role in the edge function — but
-- does need them to answer "why didn't I get a message".
drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for select using (user_id = auth.uid() or public.is_operator());

drop policy if exists notification_preferences_own_write on public.notification_preferences;
create policy notification_preferences_own_write on public.notification_preferences
  for insert with check (user_id = auth.uid());

drop policy if exists notification_preferences_own_update on public.notification_preferences;
create policy notification_preferences_own_update on public.notification_preferences
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Column grants, per the rule set by 2026-08-lock-down-self-writes.sql: never
-- blanket. user_id is grantable on INSERT because the client upserts it and
-- the policy above pins it to auth.uid() anyway; updated_at is client-written
-- because lib/api.ts sends it and there is nothing to gain by lying about it.
revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (user_id, match_reminders, teams_and_check_in, spot_opened,
              head_start, match_chat, results_and_awards, news_and_offers, updated_at)
  on public.notification_preferences to authenticated;
grant update (match_reminders, teams_and_check_in, spot_opened,
              head_start, match_chat, results_and_awards, news_and_offers, updated_at)
  on public.notification_preferences to authenticated;

comment on table public.notification_preferences is
  'Per-message opt-outs. A missing row means "all defaults" — the client treats '
  'absence as DEFAULT_NOTIFICATION_PREFS rather than as "everything off", so a '
  'player who never opened the screen still gets their match reminder.';

commit;
