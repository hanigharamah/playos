-- ============================================================================
-- Onboarding hand-off state, and turning users.phone into a real identifier
--
-- Two problems that look unrelated but are both "the column exists, nothing
-- guarantees anything about it".
--
-- ── WHY (1): the push pipeline reaches nobody ───────────────────────────────
-- app/onboarding.tsx is the screen that asks for notification permission. It
-- was built, and then nothing ever routed to it: (auth)/signup.tsx replaced
-- straight to /(tabs), and app/index.tsx only ever chose between /(tabs) and
-- /(auth)/login. So no device on any build has ever seen the OS permission
-- sheet from a fresh signup, which means the T-20 check-in reminder — the
-- notice that makes "you miss check-in, you forfeit the fee" defensible —
-- had no subscribers at all.
--
-- Routing signup through the screen is a client change. What the client needs
-- from the database is an answer to "has this ACCOUNT already been asked?",
-- because the alternatives are all worse:
--
--   * "only signup navigates there" — loses the player who is killed or
--     crashes on the onboarding screen itself. Their session persists, next
--     cold start goes through app/index.tsx, and they are never asked again.
--     That is the exact failure we are fixing, reintroduced one screen later.
--   * device-local AsyncStorage — survives nothing. Reinstall, new phone, or
--     "clear data" and the player is pitched again; and it cannot be read by
--     anything server-side that wants to know who has been asked.
--   * "no push_subscriptions row" — treats "skipped" and "never asked" as the
--     same state, so anyone who declines is re-prompted on every launch.
--
-- A nullable timestamp on the account is the durable signal: NULL means never
-- asked, non-NULL means asked (whatever the answer was). It is written once,
-- by either branch of the screen, and it survives reinstall because it lives
-- where the account lives.
--
-- Known trade-off, accepted deliberately: this is per-ACCOUNT, but OS push
-- permission is per-DEVICE. Someone who signs up on a phone and later installs
-- on a second device will not get the onboarding pitch there. That second
-- device is not left mute — app/permission/notifications.tsx already fires
-- after the first booking when permission is not granted (and it is capped
-- per device, in AsyncStorage, which is the right storage for a per-device
-- cap). Onboarding is the account's first-run pitch; that screen is the
-- per-device backstop.
--
-- ── WHY (2): users.phone cannot be an identity yet ──────────────────────────
-- The owner intends to move to WhatsApp/phone auth. Two things have to be
-- true before that migration is even possible, and neither is true today.
--
-- (a) ONE stored form. Saudi mobiles get typed as 0512345678, 512345678,
--     +966512345678 and 00966512345678, and all four are the same person.
--     Both clients call a normalizePhone() that mishandles the 00 form: it
--     tests for a leading "966" and a leading "05", and "00966512345678"
--     matches neither, so it is stored as "+96600966512345678". A phone login
--     for that account can then never match.
--
--     This is not hypothetical plumbing: public.get_user_email_by_phone()
--     already exists and is already how the web app logs a player in by
--     phone — with `where phone = user_phone`, an exact string compare. Every
--     non-canonical row is an account that cannot be signed into by phone.
--
--     Fixing the two client copies is necessary but not sufficient, because
--     the column is directly client-writable (see 2026-08-lock-down-self-
--     writes.sql, which deliberately grants UPDATE(phone) to authenticated).
--     Any REST client, any older build still in someone's TestFlight, and the
--     web app — which is a separate deployment on its own release cadence —
--     can all write whatever they like. So canonicalisation belongs in a
--     BEFORE trigger, where it applies to every writer, and the client-side
--     fix becomes an optimisation and a source of good error messages rather
--     than the enforcement point.
--
-- (b) UNIQUENESS. There is no constraint on users.phone today, so two
--     accounts can hold the same number. Under email auth that is untidy;
--     under phone auth it is unresolvable — get_user_email_by_phone() does
--     `limit 1` and would silently sign you into whichever row the planner
--     happened to return.
--
-- ORDER: apply AFTER 2026-08-lock-down-self-writes.sql (it edits that file's
-- column grants) and AFTER 2026-08-avatars.sql.
-- ============================================================================


-- ── 1. Onboarding hand-off state ────────────────────────────────────────────
alter table public.users
  add column if not exists onboarding_seen_at timestamptz;

-- Backfill every row that exists at migration time as already-seen.
--
-- The two live accounts have been using the app for weeks; showing them a
-- "welcome, turn on reminders" first-run screen on their next launch would be
-- a regression introduced by a migration. created_at (not now()) so the value
-- does not read as "was asked today" in any later analysis.
--
-- New signups after this point get the column default, NULL, and are asked.
update public.users
   set onboarding_seen_at = created_at
 where onboarding_seen_at is null;

-- The player owns this flag the same way they own their own name: it records
-- something they did on their own device. 2026-08-lock-down-self-writes.sql
-- revoked blanket UPDATE and grants columns back one at a time, so a new
-- column is unwritable by the client until it is named here.
grant update (onboarding_seen_at) on public.users to authenticated;


-- ── 2. Canonical Saudi mobile form ──────────────────────────────────────────
-- Returns +9665XXXXXXXX for anything that resolves to a Saudi mobile, and
-- NULL for anything that does not. Deliberately strict: the caller decides
-- what to do with unrecognised input, and this function never guesses.
--
-- STABLE, not VOLATILE, and no table access — safe to use in a trigger and in
-- a future check constraint or generated column.
create or replace function public.normalize_saudi_mobile(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  d        text;
  national text;
begin
  if p_phone is null then
    return null;
  end if;

  -- Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits first. A Saudi
  -- player on an Arabic keyboard types ٠٥١٢٣٤٥٦٧٨, and \D below does not
  -- consider those digits — it would strip the whole number to '' and the
  -- account would be stored with a phone that can never be matched.
  d := translate(p_phone,
                 '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
                 '01234567890123456789');

  -- Then everything that is not an ASCII digit: the leading "+", spaces,
  -- dashes, brackets. The ^5\d{8}$ gate at the end is what rejects whatever
  -- survives that it should not have.
  d := regexp_replace(d, '\D', '', 'g');
  if d = '' then
    return null;
  end if;

  -- 00 is the ITU international access prefix — "00966..." is "+966...".
  -- This is the case both client copies of normalizePhone() get wrong.
  if left(d, 2) = '00' then
    d := substr(d, 3);
  end if;

  if left(d, 3) = '966' then
    national := substr(d, 4);           -- +966 5XXXXXXXX
  elsif left(d, 1) = '0' then
    national := substr(d, 2);           -- 05XXXXXXXX  (national trunk 0)
  else
    national := d;                      -- 5XXXXXXXX   (bare subscriber)
  end if;

  -- Saudi mobile subscriber numbers are exactly 9 digits and always start 5.
  -- Landlines (01X…), short codes and foreign numbers fall out here as NULL,
  -- which is correct: this function's contract is Saudi MOBILE, because that
  -- is what WhatsApp will be keyed on.
  if national ~ '^5[0-9]{8}$' then
    return '+966' || national;
  end if;

  return null;
end;
$$;

comment on function public.normalize_saudi_mobile(text) is
  'Canonical E.164 (+9665XXXXXXXX) for any Saudi mobile input form, else NULL.';


-- ── 3. Canonicalise on every write, from every client ───────────────────────
-- Unrecognised input is passed through TRIMMED rather than nulled. Silently
-- discarding a number the operator may need to phone somebody on would be a
-- worse failure than storing an odd one; section 6 below reports them.
create or replace function public.users_canonicalise_phone()
returns trigger
language plpgsql
as $$
begin
  new.phone := coalesce(
    public.normalize_saudi_mobile(new.phone),
    nullif(btrim(coalesce(new.phone, '')), '')
  );
  return new;
end;
$$;

drop trigger if exists users_canonicalise_phone on public.users;
create trigger users_canonicalise_phone
  before insert or update of phone on public.users
  for each row
  execute function public.users_canonicalise_phone();


-- ── 4. Backfill existing rows to the canonical form ─────────────────────────
-- Only rows the function actually recognises, and only where it changes
-- something. `where phone is distinct from normalize(...)` keeps this a no-op
-- on a second run and avoids touching rows the function returns NULL for.
--
-- At the time of writing this moves zero rows: hanigharamah@gmail.com is
-- already '+966534478561' and operator@playos.sa is NULL. It is written to be
-- correct anyway, because this file has to be re-runnable and because staging
-- and any future restore will not have those two rows.
update public.users
   set phone = public.normalize_saudi_mobile(phone)
 where phone is not null
   and public.normalize_saudi_mobile(phone) is not null
   and phone is distinct from public.normalize_saudi_mobile(phone);


-- ── 5. Uniqueness ───────────────────────────────────────────────────────────
-- Refuse to create the index over dirty data rather than half-applying. If
-- this ever fires, the duplicates have to be merged by hand — there is no
-- automatic answer to "which of these two accounts is the real person", and
-- guessing would delete somebody's booking history.
do $$
declare
  n int;
begin
  select count(*) into n from (
    select phone from public.users
     where phone is not null
     group by phone having count(*) > 1
  ) dupes;
  if n > 0 then
    raise exception
      'users.phone has % duplicated value(s); merge those accounts before applying this migration', n;
  end if;
end;
$$;

-- PARTIAL, on `phone is not null`.
--
-- A plain unique index would technically work — Postgres already treats NULLs
-- as distinct, so the two live accounts (one number, one NULL) would both be
-- fine, and so would any number of future NULLs. The partial form is used
-- because it states that intent explicitly instead of relying on the reader
-- knowing that rule, and because it keeps the index off rows that can never
-- collide. operator@playos.sa has a NULL phone and must keep working.
--
-- NOT NOT NULL: phone stays optional at the database level. Making it
-- required is a decision for the WhatsApp-auth migration, and it cannot be
-- taken while an admin account legitimately has no number.
create unique index if not exists users_phone_key
  on public.users (phone)
  where phone is not null;


-- ── 6. Report, don't guess ──────────────────────────────────────────────────
-- Anything that survived section 4 without becoming canonical. Run before the
-- WhatsApp-auth migration; every row it returns is an account that will not
-- be able to log in by phone.
--
--   select id, email, phone from public.users
--    where phone is not null
--      and phone is distinct from public.normalize_saudi_mobile(phone);


-- ── 7. Verifying ────────────────────────────────────────────────────────────
-- All four of these must return '+966512345678':
--
--   select public.normalize_saudi_mobile('0512345678');
--   select public.normalize_saudi_mobile('512345678');
--   select public.normalize_saudi_mobile('+966512345678');
--   select public.normalize_saudi_mobile('00966512345678');
--
-- And as a signed-in player, this must fail with 23505 when the number is
-- already held by another account:
--
--   PATCH /rest/v1/users?id=eq.<me>  {"phone": "<someone else's>"}
--
-- The final statement below is a real one on purpose: `supabase db query
-- --file` silently drops the last statement when a file ends in a trailing
-- comment block, so this file must not end on prose.
comment on column public.users.onboarding_seen_at is
  'When this account was shown the first-run notification-permission screen (app/onboarding.tsx). NULL = never shown. Set by either branch, Enable or Skip.';
