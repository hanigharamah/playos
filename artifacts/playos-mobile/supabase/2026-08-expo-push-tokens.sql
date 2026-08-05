-- ============================================================================
-- push_subscriptions: make it actually able to hold an Expo push token
--
-- WHY THIS EXISTS
--
-- lib/notifications.ts has been shipping this since the native rewrite:
--
--     supabase.from("push_subscriptions").upsert(
--       { user_id, expo_push_token, platform },
--       { onConflict: "expo_push_token" })
--
-- Against the live database that call could never have succeeded. The table is
-- still the original web-PWA shape — (id, user_id, endpoint, p256dh, auth,
-- created_at) — so `expo_push_token` and `platform` are unknown columns, there
-- is nothing for ON CONFLICT to infer, and endpoint/p256dh/auth are NOT NULL
-- with no defaults. Three independent reasons for the same 400. The result is
-- that no device has ever registered: registerForPush() returns
-- {status:"error"} and the onboarding sheet swallows it.
--
-- That is not just "notifications are off". `send-match-reminders` runs every
-- two minutes on pg_cron and has been returning {"sent":0,"games":0} forever,
-- because it fans out over rows that do not exist. The reminder it exists to
-- deliver is the T-20 check-in warning, and missing check-in forfeits the
-- player's full fee. We have been enforcing a forfeit for ignoring a warning we
-- never sent. Fixing the schema is the precondition for that policy being
-- defensible at all.
--
-- 2026-07-push-native.sql was written to do this and was never applied — the
-- probe below confirms none of its columns exist. It is also subtly wrong, so
-- this file supersedes it rather than re-running it (see section 2).
--
-- ORDER: apply AFTER 2026-08-lock-down-self-writes.sql — it inherits that
-- file's rule that write access is granted per column, never blanket.
-- ============================================================================


-- ── 1. Web columns become optional, not deleted ─────────────────────────────
-- Tempting to drop endpoint/p256dh/auth now that mobile is the product, but
-- the web PWA still writes them: playos/src/lib/push.ts upserts a VAPID
-- subscription with exactly those three fields. Dropping them breaks the web
-- app the moment this runs. Instead we relax NOT NULL so a native row — which
-- has no endpoint and no VAPID keys — can exist in the same table, which is
-- what lets one edge function iterate every device a player owns.
alter table public.push_subscriptions
  alter column endpoint drop not null,
  alter column p256dh   drop not null,
  alter column auth     drop not null;

alter table public.push_subscriptions
  add column if not exists expo_push_token text,
  add column if not exists platform text,
  add column if not exists updated_at timestamptz not null default now();

-- Every pre-existing row came from the browser flow.
update public.push_subscriptions
   set platform = 'web'
 where platform is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.push_subscriptions'::regclass
       and conname  = 'push_subscriptions_platform_check'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_platform_check
      check (platform in ('web', 'ios', 'android'));
  end if;
end $$;

-- A row is a web subscription or a native one. Never neither — a row with no
-- delivery address at all is invisible garbage that still counts toward
-- "this player has notifications on", which is exactly how you end up
-- believing a reminder went out when it did not.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.push_subscriptions'::regclass
       and conname  = 'push_subscriptions_addressable_check'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_addressable_check
      check (endpoint is not null or expo_push_token is not null);
  end if;
end $$;


-- ── 2. A real UNIQUE CONSTRAINT, not the partial index we almost shipped ────
-- 2026-07-push-native.sql created:
--
--   create unique index ... on push_subscriptions (expo_push_token)
--     where expo_push_token is not null;
--
-- which looks more careful and is in fact useless here. Postgres can only
-- infer a PARTIAL index for ON CONFLICT if the INSERT repeats the index
-- predicate, and PostgREST's ?on_conflict=expo_push_token emits a bare
-- ON CONFLICT (expo_push_token) — so the upsert would still have failed, with
-- 42P10 instead of 42703. A plain UNIQUE constraint is inferrable and is no
-- less correct: Postgres treats NULLs as distinct by default, so the existing
-- web rows (expo_push_token IS NULL) do not collide with each other.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.push_subscriptions'::regclass
       and conname  = 'push_subscriptions_expo_push_token_key'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_expo_push_token_key unique (expo_push_token);
  end if;
end $$;

-- The token is the device identity, so it is the conflict target rather than
-- (user_id, expo_push_token): a token must map to exactly one player. If a
-- device could appear under two user_ids, the second player's T-20 reminder
-- lands on the first player's phone.
drop index if exists public.push_subscriptions_expo_token_key;

-- Fan-out reads by user_id every two minutes; nothing indexed it until now.
create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);


-- ── 3. updated_at maintained server-side ────────────────────────────────────
-- Expo tokens rotate and go stale silently. A client-supplied timestamp is
-- worthless for pruning (a device that stopped opening the app also stops
-- sending one), so the trigger stamps it on every write, including the DO
-- UPDATE half of an upsert.
create or replace function public.touch_push_subscription()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_touch on public.push_subscriptions;
create trigger push_subscriptions_touch
  before update on public.push_subscriptions
  for each row execute function public.touch_push_subscription();


-- ── 4. Grants: per column, per 2026-08-lock-down-self-writes.sql ────────────
-- The table currently carries blanket table-level INSERT/UPDATE/DELETE for
-- BOTH authenticated and anon. RLS ("push: manage own", user_id = auth.uid())
-- is what has actually been containing that, and auth.uid() is null for anon
-- so no anon row was ever writable — but the grant is still wrong, and the new
-- columns would otherwise inherit the same blanket access.
revoke all on public.push_subscriptions from anon;
revoke all on public.push_subscriptions from authenticated;

grant select, delete on public.push_subscriptions to authenticated;

-- INSERT must include user_id: RLS WITH CHECK requires user_id = auth.uid(),
-- so the client has to be able to write the column it is then checked against.
grant insert (user_id, expo_push_token, platform, endpoint, p256dh, auth)
  on public.push_subscriptions to authenticated;

-- UPDATE also needs user_id, because PostgREST's upsert compiles to
-- ON CONFLICT DO UPDATE SET over every column in the payload, user_id
-- included. This is not a hole: the UPDATE policy's USING clause means a row
-- belonging to someone else is not visible to update in the first place, so
-- user_id can only ever be rewritten from auth.uid() to auth.uid().
--
-- Deliberately NOT granted: id (surrogate key), created_at (would let a
-- device backdate itself out of a staleness sweep), updated_at (section 3
-- owns it).
grant update (user_id, expo_push_token, platform, endpoint, p256dh, auth)
  on public.push_subscriptions to authenticated;

-- The existing "push: manage own" policy is FOR ALL TO public with both
-- USING and WITH CHECK on user_id = auth.uid(), which is already the isolation
-- we want; it is restated here scoped to `authenticated` so an unauthenticated
-- request is refused by the policy and not only by the null-uid comparison.
drop policy if exists "push: manage own" on public.push_subscriptions;
create policy "push: manage own"
  on public.push_subscriptions
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── 5. Device handoff needs a definer function ──────────────────────────────
-- Section 4 is correct and has one consequence worth naming: if player A signs
-- out on a phone and player B signs in, the Expo token is unchanged but the
-- row belongs to A, so B's upsert hits ON CONFLICT, cannot see A's row through
-- RLS, and fails with 42501. B silently never registers — the same class of
-- invisible failure this migration exists to end.
--
-- A pure-RLS fix is impossible: "may overwrite a row you do not own" is
-- precisely the property we must not grant. So this is a SECURITY DEFINER
-- function, in the same shape as cancel_my_booking and claim_spot: it takes no
-- user_id from the caller, reads auth.uid() itself, and the only privileged
-- thing it does is release a token that some other account is holding — which
-- is safe, because possession of the token proves possession of the device.
create or replace function public.register_push_token(
  p_token    text,
  p_platform text
)
returns table (subscription_id uuid, reassigned boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_prev_owner uuid;
  v_id         uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'push token required' using errcode = '22023';
  end if;
  if p_platform not in ('ios', 'android', 'web') then
    raise exception 'unsupported platform %', p_platform using errcode = '22023';
  end if;

  select user_id into v_prev_owner
    from public.push_subscriptions
   where expo_push_token = p_token;

  insert into public.push_subscriptions (user_id, expo_push_token, platform)
  values (v_uid, p_token, p_platform)
  on conflict (expo_push_token) do update
    set user_id    = excluded.user_id,
        platform   = excluded.platform,
        updated_at = now()
  returning id into v_id;

  return query select v_id, (v_prev_owner is not null and v_prev_owner <> v_uid);
end;
$$;

-- Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE on every new public
-- function to anon and authenticated, and that is an explicit role grant, so
-- `revoke from public` does not clear it. anon must be revoked by name.
-- The auth.uid() guard above would reject an anonymous call anyway; this makes
-- a SECURITY DEFINER function unreachable rather than merely unproductive.
revoke all on function public.register_push_token(text, text) from public;
revoke all on function public.register_push_token(text, text) from anon;
grant execute on function public.register_push_token(text, text) to authenticated;


-- ── 6. Still blocking a real push ───────────────────────────────────────────
-- Schema is only half of it. supabase/functions/send-match-reminders/index.ts
-- selects (id, endpoint, p256dh, auth) and sends via web-push/VAPID only. It
-- will now read native rows and hand webpush an undefined endpoint, so Expo
-- devices register successfully and still receive nothing. That function needs
-- to split its fan-out: VAPID for rows with an endpoint, a POST to
-- https://exp.host/--/api/v2/push/send for rows with an expo_push_token, and
-- DeviceNotRegistered in the Expo response should delete the row the same way
-- a 404/410 does today.
select
  (select count(*) from public.push_subscriptions where platform = 'web')     as web_subs,
  (select count(*) from public.push_subscriptions where platform = 'ios')     as ios_subs,
  (select count(*) from public.push_subscriptions where platform = 'android') as android_subs;
