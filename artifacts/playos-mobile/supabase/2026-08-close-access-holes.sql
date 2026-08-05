-- ============================================================================
-- Three access findings, verified by execution
--
-- ── 1. anon holds write grants on eleven tables ─────────────────────────────
-- 2026-08-lock-down-self-writes.sql revoked blanket writes `from
-- authenticated` and never `from anon`, so INSERT/UPDATE/DELETE/TRUNCATE
-- remained granted to unauthenticated callers on users, games, bookings,
-- pitches, app_settings, ops_audit_log and five more.
--
-- IMPORTANT, so nobody panics reading this later: RLS is enabled on all of
-- them and IS currently holding. Verified by executing as `anon` with no JWT:
-- UPDATE on users, games, app_settings and bookings each affected 0 rows.
-- This is defence in depth, not an open door — but a GRANT that only RLS
-- stands behind means one loose policy is a breach, and the push_subscriptions
-- hole proved these accumulate silently.
--
-- ── 2. a phone number returns its owner's email, to anyone ──────────────────
-- get_user_email_by_phone is SECURITY DEFINER and executable by anon, so it
-- bypasses the RLS that correctly blocks reading another player's row.
-- Executed with NO JWT: it returned the owner's real email address.
--
-- The phone-identity work makes this worse rather than better: canonical,
-- unique E.164 numbers turn it into an unambiguous lookup over a small
-- keyspace.
--
-- It cannot simply be revoked — artifacts/playos (the web app, which is out of
-- scope for this repo's mobile work) calls it for host phone+password login.
-- So it is narrowed to what that flow actually needs: HOST accounts only. A
-- player's email is no longer reachable, which is all but two rows today.
--
-- ── 3. Arabic-Indic digits defeat phone uniqueness ──────────────────────────
-- normalize_saudi_mobile only understands ASCII digits. Arabic-Indic (٠١٢…)
-- and Extended Arabic-Indic (۰۱۲…) return NULL, the trigger's fallback stores
-- them verbatim, and users_phone_key compares bytes — so ٠٥٣٤٤٧٨٥٦١ and
-- +966534478561 are two different keys for one phone. A second account
-- claimed the owner's real number this way.
--
-- Both digit sets are what an Arabic keyboard produces. For an app in Riyadh
-- this is the normal case, not an edge case.
-- ============================================================================

begin;

-- ── 1. anon writes nothing ──────────────────────────────────────────────────
do $$
declare t record;
begin
  for t in
    select distinct table_name from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon'
       and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
  loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon', t.table_name);
  end loop;
end $$;

-- ── 2. the email lookup is for hosts, not for everyone ──────────────────────
create or replace function public.get_user_email_by_phone(user_phone text)
returns text
language sql
security definer
set search_path to 'public'
as $function$
  -- Canonicalised on the way in, so a caller passing 0534478561 and a row
  -- stored as +966534478561 still match. Without this, narrowing the function
  -- would also have broken host login for anyone who types the local form.
  select u.email
    from public.users u
   where u.phone = coalesce(public.normalize_saudi_mobile(user_phone), btrim(user_phone))
     -- Host login only. A player's address is not reachable through this any
     -- more, which is the whole point.
     and u.role in ('admin', 'organiser', 'host')
   limit 1;
$function$;

comment on function public.get_user_email_by_phone(text) is
  'Phone -> email for the WEB host login flow only, and only for host/admin '
  'accounts. Deliberately not revoked from anon because that login happens '
  'before authentication; narrowed instead. Do not widen it to players — it '
  'bypasses RLS by design and would become a PII oracle over a unique, '
  'canonical phone keyspace.';

-- ── 3. the normaliser understands Arabic digits ─────────────────────────────
create or replace function public.normalize_saudi_mobile(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  if p_phone is null then return null; end if;

  -- Fold Arabic-Indic (U+0660..0669) and Extended Arabic-Indic (U+06F0..06F9)
  -- onto ASCII before anything else looks at the string. This is the step the
  -- deployed version was missing, and it is why two accounts could hold one
  -- number: unrecognised input falls through to raw passthrough, and the
  -- unique index compares bytes.
  v := translate(p_phone,
                 '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
                 '01234567890123456789');

  -- Strip everything that is not a digit or a leading +.
  v := regexp_replace(v, '[^0-9+]', '', 'g');
  v := regexp_replace(v, '(?!^)\+', '', 'g');

  -- Converge the four ways a Saudi mobile gets written.
  if v ~ '^\+9665[0-9]{8}$'  then return v;                        end if;
  if v ~ '^009665[0-9]{8}$'  then return '+' || substring(v from 3); end if;
  if v ~ '^9665[0-9]{8}$'    then return '+' || v;                  end if;
  if v ~ '^05[0-9]{8}$'      then return '+966' || substring(v from 2); end if;
  if v ~ '^5[0-9]{8}$'       then return '+966' || v;               end if;

  -- Not a Saudi mobile. Null, and the trigger keeps the trimmed original --
  -- a number the operator may still need to ring.
  return null;
end;
$$;

comment on function public.normalize_saudi_mobile(text) is
  'Canonicalise a Saudi mobile to E.164 (+9665XXXXXXXX). Folds Arabic-Indic '
  'and Extended Arabic-Indic digits to ASCII first — an Arabic keyboard '
  'produces them by default, and without that step the same number stored in '
  'two scripts is two different keys to the unique index.';

commit;

-- ── 4. bookings cannot be self-inserted ─────────────────────────────────────
-- 2026-08-lock-down-self-writes.sql correctly narrowed UPDATE to
-- (payment_method, reconfirmed_at) — a player could no longer PATCH their own
-- booking to paid or checked-in. But INSERT was left granted on all fifteen
-- columns, so the same result was one POST away: create the row already
-- payment_status='paid', checked_in=true. Same T-20 forfeit bypass, different
-- verb. That file's closing note defers INSERT deliberately; the deferral is
-- the hole.
--
-- Revoked outright rather than narrowed, because the client no longer inserts
-- bookings at all — every booking now comes from claim_spot(), which is
-- SECURITY DEFINER and runs as owner. Verified: no `from("bookings").insert`
-- remains anywhere in lib, app or components.
revoke insert on public.bookings from authenticated, anon;

-- Same reasoning for games and pitches: a player could inject rows into the
-- public catalogue, and one such row flips them into delete_my_account's
-- is_organiser branch permanently — letting a player disable their own
-- App-Store-mandated account deletion. Nothing client-side creates either.
revoke insert, update on public.games   from authenticated, anon;
revoke insert, update on public.pitches from authenticated, anon;

-- ── 5. no client deletes anything ───────────────────────────────────────────
-- DELETE and TRUNCATE were still granted to `authenticated` across the schema.
-- On games that is not a small thing: bookings.game_id cascades, so a player
-- deleting a game destroys every other player's booking on it.
--
-- Swept rather than listed table by table, because the pattern that produced
-- this hole is "a table was added later and nobody revisited the grants".
-- Verified first that exactly one client-side delete exists in the whole app
-- (useDeleteGame in lib/api.ts) and that it is dead code — defined, never
-- called from any screen. It is removed in the same commit.
do $$
declare t record;
begin
  for t in
    select distinct table_name from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('authenticated','anon')
       and privilege_type in ('DELETE','TRUNCATE')
  loop
    execute format('revoke delete, truncate on public.%I from authenticated, anon', t.table_name);
  end loop;
end $$;
