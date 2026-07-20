-- ============================================================================
-- PlayOS mobile — add native push-token columns to push_subscriptions
-- Safe to run more than once. Run in Supabase SQL editor.
-- ============================================================================

-- Native (Expo/APNs/FCM) tokens live alongside the web VAPID subscriptions
-- so a single edge function can iterate all of a player's registered devices.
alter table public.push_subscriptions
  add column if not exists expo_push_token text,
  add column if not exists platform text
    check (platform in ('web', 'ios', 'android'));

-- Existing rows were all web; backfill so the check constraint holds.
update public.push_subscriptions
  set platform = 'web' where platform is null and endpoint is not null;

-- Web rows use `endpoint` as the natural key; native rows use `expo_push_token`.
-- One row per device — a player can have many.
create unique index if not exists push_subscriptions_expo_token_key
  on public.push_subscriptions (expo_push_token)
  where expo_push_token is not null;

-- Report.
select
  (select count(*) from public.push_subscriptions where platform = 'web')     as web_subs,
  (select count(*) from public.push_subscriptions where platform = 'ios')     as ios_subs,
  (select count(*) from public.push_subscriptions where platform = 'android') as android_subs;
