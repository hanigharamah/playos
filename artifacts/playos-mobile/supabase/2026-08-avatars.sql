-- ============================================================================
-- Player avatar photos — bucket, column, grant, and lineup passthrough
--
-- 2026-08-game-lineup.sql put real first names on Home's promo card, on the
-- finding that WHO is going converts better than how many in a group this
-- size. It deliberately stopped at names and said so: "no avatars". This is
-- that follow-up, and it is a full chain rather than a display change.
--
-- Probed against the live database 2026-08-04, before writing any of this:
--   * public.users has exactly seven columns — id, email, phone, name, role,
--     created_at, credits. There is no avatar_url, no photo, no image.
--   * storage.buckets is EMPTY. Not "no avatars bucket" — no buckets at all,
--     so this is the first use of storage in the project.
-- Everything below therefore creates rather than alters, except the users
-- grant in section 3, which has to be re-stated for a reason explained there.
--
-- PRIVACY. Ratified by the product owner 2026-08-04, as a separate decision
-- from the first-name one: a player's avatar is visible to ANY SIGNED-IN
-- player, and to nobody else. Two consequences that are easy to get wrong:
--
--   1. The bucket is PRIVATE (public = false). A public bucket would put every
--      player's face on an unauthenticated URL that anyone who guessed a user
--      id could fetch — broader than what was ratified, and inconsistent with
--      get_game_lineup, which returns nothing at all when auth.uid() is null.
--      Reads go through short-lived signed URLs instead; see section 2.
--   2. "Players who share a game" was considered and rejected. It would have
--      defeated the feature: the promo card exists to sell a game you have
--      NOT booked, so you share no game with anyone in its lineup, and every
--      disc would fall back to an initial in exactly the case that matters.
--
-- ORDER: apply AFTER 2026-08-lock-down-self-writes.sql — section 3 depends on
-- the column-level grant that migration introduced.
-- ============================================================================

-- ── 1. The bucket ───────────────────────────────────────────────────────────
-- Private, as above. The limits are here rather than in the client because the
-- client is the thing we do not control: a 5 MB cap and an image-only MIME
-- allowlist mean a modified build cannot park a 200 MB video in the bucket.
-- 5 MB is generous for a cropped square — an iPhone photo through the crop at
-- quality 0.7 lands around 100-300 KB — and leaves room for an unprocessed
-- upload from a future Android path without a migration to raise it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  5242880,                                    -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- ── 2. Who may read and write an object ─────────────────────────────────────
-- Objects are stored at '<user_id>/avatar.jpg'. The first path segment IS the
-- owner, which is what makes "only your own object" expressible: storage RLS
-- has no column-level equivalent of the users grant below, so ownership has to
-- live in the key. One fixed filename per player, overwritten on re-upload, so
-- a player who changes their photo five times leaves one object and not five
-- orphans nobody will ever clean up.
--
-- storage.foldername(name) splits the key on '/', so [1] is that user id. It
-- is text; users.id is uuid; hence the cast on auth.uid() rather than on the
-- path, which would throw on a malformed key instead of simply not matching.

drop policy if exists "avatars are readable by signed-in players" on storage.objects;
create policy "avatars are readable by signed-in players"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "players write their own avatar" on storage.objects;
create policy "players write their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Re-uploading is an UPDATE once the object exists (the client uses upsert),
-- so without this a player could set a photo once and never change it. Both
-- USING and WITH CHECK are needed: the first says which row you may modify,
-- the second stops you renaming it into someone else's folder.
drop policy if exists "players replace their own avatar" on storage.objects;
create policy "players replace their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "players remove their own avatar" on storage.objects;
create policy "players remove their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 3. users.avatar_url ─────────────────────────────────────────────────────
-- Holds the STORAGE OBJECT PATH ('<user_id>/avatar.jpg'), not an https URL.
-- The bucket is private, so there is no durable public URL to store; the
-- client signs the path for display. Keeping the path means a signed link that
-- has expired is never persisted, and the bucket could be renamed without
-- rewriting every row. The column keeps the name avatar_url because that is
-- what the rest of the codebase and the web app call it.
alter table public.users add column if not exists avatar_url text;

comment on column public.users.avatar_url is
  'Storage object path in the private ''avatars'' bucket, e.g. ''<user_id>/avatar.jpg''. '
  'NOT a public URL — the client signs it for display. Null means no photo, which is '
  'the normal state and must render the gradient-initial fallback.';

-- 2026-08-lock-down-self-writes.sql revoked the blanket UPDATE on public.users
-- and granted back only (name, phone), because credits is a wallet balance and
-- role gates the operator screens. A new column is NOT covered by that grant,
-- so without this line a player gets 42501 the moment they try to set their
-- own photo. Re-stating the whole grant rather than adding to it: column
-- grants are additive, so this is idempotent, and having the full set of
-- self-writable columns visible in one statement is what stops the next
-- column from quietly missing the same way.
grant update (name, phone, avatar_url) on public.users to authenticated;

-- ── 4. get_game_lineup returns the photo alongside the name ─────────────────
-- Same function, same privacy rule, one more column. Restating it in full
-- because the return type changes and Postgres will not let a replace alter
-- it, so this has to drop first.
--
-- Unchanged and deliberately so: signed-in callers only, first names only, no
-- surnames, no user ids, no phone numbers, longest-standing bookings first so
-- the order stays stable as the game fills.
drop function if exists public.get_game_lineup(text, int);

create function public.get_game_lineup(
  p_game_id text,
  p_limit   int default 3
)
returns table (first_name text, avatar_url text, total int)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Signed-in players only. The lineup is not public to the internet.
  if auth.uid() is null then
    return;
  end if;

  return query
    with active as (
      select b.user_id, b.booked_at
        from public.bookings b
       where b.game_id = p_game_id
         and b.payment_status not in ('refunded', 'forfeited')
    )
    select
      -- First token of the name only. split_part returns '' rather than null
      -- on an empty name, and nullif keeps those out of the card.
      nullif(split_part(coalesce(u.name, ''), ' ', 1), '') as first_name,
      -- A path, not a URL, and null for everyone who has not uploaded — which
      -- at launch is everyone. The card must fall back to the initial rather
      -- than render an empty disc.
      u.avatar_url                                         as avatar_url,
      (select count(*)::int from active)                   as total
      from active a
      join public.users u on u.id = a.user_id
     order by a.booked_at asc
     limit greatest(p_limit, 0);
end;
$$;

grant execute on function public.get_game_lineup(text, int) to authenticated;

comment on function public.get_game_lineup(text, int) is
  'First names and avatar paths of players booked into a game, for social proof on '
  'promo cards. First names only by design; avatar_url is a private-bucket object '
  'path the caller must sign. See the privacy note in 2026-08-avatars.sql.';

-- ── 5. Verifying ────────────────────────────────────────────────────────────
-- Apply with:
--   npx supabase db query --linked --file supabase/2026-08-avatars.sql
-- (the CLI runs via npx and the project is already linked to tnqlvszrcskvuqtdcded)
--
-- The bucket exists and is private:
--   select id, public, file_size_limit from storage.buckets where id = 'avatars';
--   -> avatars | f | 5242880
--
-- The column is self-writable, as a signed-in player — this must now succeed,
-- where before this migration it failed with 42501:
--   PATCH /rest/v1/users?id=eq.<me>  {"avatar_url": "<me>/avatar.jpg"}
--
-- And the things lock-down-self-writes closed must STILL fail with 42501:
--   PATCH /rest/v1/users?id=eq.<me>  {"credits": 9999}
--   PATCH /rest/v1/users?id=eq.<me>  {"role": "operator"}
--
-- Writing to someone else's folder must fail with 42501:
--   POST /storage/v1/object/avatars/<some-other-user-id>/avatar.jpg
--
-- The lineup carries the new column, as a signed-in player, for a game you
-- have NOT booked:
--   POST /rest/v1/rpc/get_game_lineup {"p_game_id":"<id>","p_limit":3}
--   -> [{"first_name":"Ali","avatar_url":"a1b2.../avatar.jpg","total":7},
--       {"first_name":"Ahmed","avatar_url":null,"total":7}, ...]
--
-- And unauthenticated, which must still return nothing:
--   -> []
