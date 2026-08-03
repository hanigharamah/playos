-- ============================================================================
-- Cartoon avatar presets — the third option, and the only one that works on
-- day one
--
-- 2026-08-game-lineup.sql put first names on the promo card, on the finding
-- that WHO is going converts better than how many spots are left in a group
-- this size. 2026-08-avatars.sql added photos. Both leave a hole at launch:
--
--   * a photo needs someone to have uploaded one, and on day one nobody has;
--   * an initial gives ~35 players roughly nine distinguishable discs, since
--     Arabic first names cluster hard on A, M and S.
--
-- A preset is pickable in one tap from the moment a player signs up, so it is
-- the only one of the three that is populated on the first match night — which
-- is exactly when the conversion lever matters most.
--
-- NOT an image. The faces are generated at display time by @dicebear/core
-- (MIT, offline, ~3.5 KB of SVG each) from a frozen seed list in
-- lib/avatarPresets.ts. This column stores only WHICH ONE, so there is no
-- bucket, no upload, no moderation and no asset pipeline behind it.
--
-- THE SEED LIST IS FROZEN. avatar_preset holds a 1-based index into it, so
-- reordering or editing a seed would silently change the face of every player
-- who chose it. Append only.
--
-- ORDER: apply AFTER 2026-08-avatars.sql — section 2 restates the column grant
-- that migration last touched.
-- ============================================================================

-- ── 1. The column ───────────────────────────────────────────────────────────
-- Null means "not chosen", which is the normal state and must fall through to
-- the gradient initial. The check constraint keeps a bad client from parking a
-- value the app cannot render: lib/avatarPresets.ts ships ten seeds, and an
-- out-of-range id would render an empty disc on the highest-attention element
-- of the home screen.
alter table public.users
  add column if not exists avatar_preset smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_avatar_preset_range'
  ) then
    alter table public.users
      add constraint users_avatar_preset_range
      check (avatar_preset is null or (avatar_preset between 1 and 10));
  end if;
end $$;

comment on column public.users.avatar_preset is
  '1-based index into the frozen seed list in lib/avatarPresets.ts. Null means '
  'no preset chosen, which falls back to the gradient initial. Photo wins over '
  'preset wins over initial. Raising the upper bound needs a matching seed appended '
  'to that file FIRST — the list is append-only, never reordered.';

-- ── 2. The grant ────────────────────────────────────────────────────────────
-- 2026-08-lock-down-self-writes.sql revoked the blanket UPDATE on public.users
-- because credits is a wallet balance and role gates the operator screens.
-- Column grants do not cover columns added later, so without this line a
-- player gets 42501 the moment they pick a face. Restated in full rather than
-- appended: having every self-writable column in one statement is what stops
-- the next column from quietly missing the same way — which is exactly how
-- avatar_url nearly shipped broken.
grant update (name, phone, avatar_url, avatar_preset) on public.users to authenticated;

-- ── 3. The lineup carries it ────────────────────────────────────────────────
-- Dropped first: the return type changes, and Postgres will not replace a
-- function whose OUT columns differ.
drop function if exists public.get_game_lineup(text, int);

create function public.get_game_lineup(
  p_game_id text,
  p_limit   int default 3
)
returns table (first_name text, avatar_url text, avatar_preset smallint, total int)
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
      -- A storage object PATH, not a URL — the bucket is private and the
      -- client signs it. Null for everyone who has not uploaded.
      u.avatar_url                                         as avatar_url,
      u.avatar_preset                                      as avatar_preset,
      (select count(*)::int from active)                   as total
      from active a
      join public.users u on u.id = a.user_id
     -- Longest-standing bookings first: the players who committed early are
     -- the ones whose names carry weight, and the order stays stable as the
     -- game fills rather than reshuffling on every new booking.
     order by a.booked_at asc
     limit greatest(p_limit, 0);
end;
$$;

grant execute on function public.get_game_lineup(text, int) to authenticated;

comment on function public.get_game_lineup(text, int) is
  'First names, photo paths and cartoon presets for players booked into a game, '
  'for social proof on promo cards. First names only by design; see the privacy '
  'note in 2026-08-avatars.sql.';

-- Verifying, as a signed-in player, against a game you have NOT booked:
--   POST /rest/v1/rpc/get_game_lineup {"p_game_id":"<id>","p_limit":3}
--   -> [{"first_name":"Ali","avatar_url":null,"avatar_preset":3,"total":7}, ...]
--
-- And that the constraint holds:
--   PATCH /rest/v1/users?id=eq.<me> {"avatar_preset": 11}   -> 23514
--   PATCH /rest/v1/users?id=eq.<me> {"avatar_preset": 3}    -> 204
