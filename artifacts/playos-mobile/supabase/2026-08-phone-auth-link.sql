-- ============================================================================
-- Make public.users.phone reach auth.users.phone
--
-- Supabase's phone sign-in looks the account up by auth.users.phone. The app
-- only ever wrote public.users.phone — signup does an UPDATE on the profile
-- after signUp() — so auth.users.phone is NULL on every account that exists.
--
-- Without this, WhatsApp sign-in answers "no account uses that number" to a
-- player whose number we are storing and displaying. And it is not a one-off
-- backfill: every NEW signup would land the same way, because nothing in the
-- signup path touches the auth row.
--
-- So: a backfill AND a trigger that keeps them in step.
--
-- phone_confirmed_at is deliberately NOT set. Setting it would assert we have
-- verified the player controls that number, and we have not — they typed it
-- into a form. The first successful OTP confirms it, which is what
-- confirmation is supposed to mean.
-- ============================================================================

begin;

-- ── 1. Keep the auth row in step from now on ────────────────────────────────
-- SECURITY DEFINER because public.users is written by the client (via the
-- narrow column grants) but auth.users is not writable by anyone but the
-- owner. The function is owned by postgres, so the trigger can bridge that
-- without widening any client's rights.
create or replace function public.sync_phone_to_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only when it actually changed, so an unrelated profile UPDATE does not
  -- touch the auth row on every write.
  if new.phone is distinct from old.phone then
    begin
      update auth.users
         set phone = new.phone
       where id = new.id;
    exception
      -- auth.users.phone is unique. public.users.phone is unique too, so this
      -- should be unreachable — but if the two ever disagree, a failed profile
      -- save is a worse outcome than a stale auth row, and the mismatch is
      -- visible in the query at the bottom of this file.
      when unique_violation then
        raise warning 'phone % already on another auth user; auth row not updated', new.phone;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists users_sync_phone_to_auth on public.users;
create trigger users_sync_phone_to_auth
  after insert or update of phone on public.users
  for each row
  execute function public.sync_phone_to_auth();

-- ── 2. Backfill what is already there ───────────────────────────────────────
-- Only rows where the profile has a phone and the auth row does not, and only
-- where no OTHER auth user already holds that number. Idempotent.
update auth.users a
   set phone = pu.phone
  from public.users pu
 where pu.id = a.id
   and pu.phone is not null
   and a.phone is null
   and not exists (
     select 1 from auth.users other
      where other.phone = pu.phone and other.id <> a.id
   );

commit;

-- Verifying, and the query to run if WhatsApp sign-in ever says a real number
-- is unknown:
--   select u.email, a.phone as auth_phone, u.phone as profile_phone
--     from public.users u join auth.users a on a.id = u.id
--    where a.phone is distinct from u.phone;
-- Any row returned is an account whose sign-in number disagrees with the one
-- shown in the app.
