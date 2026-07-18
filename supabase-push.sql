-- ============================================================================
-- PlayOS — Web Push subscription storage + match-reminder scheduling
-- Run in Supabase SQL editor. Safe to run more than once.
-- ============================================================================

-- ── push_subscriptions ───────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push: manage own" on public.push_subscriptions;
create policy "push: manage own"
  on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── games.reminder_sent_at — idempotency guard for the T-20 push ────────────
alter table public.games
  add column if not exists reminder_sent_at timestamptz;

-- ── Report ───────────────────────────────────────────────────────────────────
select 'push_subscriptions table' as item, count(*) as ok
  from information_schema.tables where table_name = 'push_subscriptions'
union all
select 'reminder_sent_at column', count(*)
  from information_schema.columns where table_name = 'games' and column_name = 'reminder_sent_at';
