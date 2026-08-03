-- ============================================================================
-- Who's playing — first names for an open game
--
-- Home's hero card already draws avatar discs, but nothing behind them: the
-- games feed returns bookedCount and no identities at all (GameSummary in
-- lib/api.ts), so the discs render as anonymous gradients.
--
-- get_game_roster cannot fill them. Probed 2026-08-04: it returns [] for a
-- game that HAS a booking when the caller is not in that game, so it is gated
-- to participants and/or filtered to checked-in players. Correct for the
-- match-day room, useless for promoting a game to someone who has not joined.
--
-- WHY THIS MATTERS COMMERCIALLY. Research into small-group attendance is
-- consistent on two points: turnout rises with WHO is going rather than how
-- many, and publishing a bare headcount can actively backfire — people read a
-- number and conclude their absence will not be noticed. With ~35 players who
-- know each other, names are the strongest conversion lever available, and
-- they belong in the highest-attention element on the screen.
--
-- PRIVACY. Ratified by the product owner, 2026-08-04: first names of players
-- booked into a game are visible to any signed-in player. Deliberately FIRST
-- NAMES ONLY — no surnames, no user ids, no avatars, no phone numbers. This
-- is the same disclosure Playtomic makes in this market, and it is the minimum
-- that makes the lever work. Revisit if the community grows past the point
-- where everyone plausibly knows everyone.
-- ============================================================================

create or replace function public.get_game_lineup(
  p_game_id text,
  p_limit   int default 3
)
returns table (first_name text, total int)
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
  'First names of players booked into a game, for social proof on promo cards. '
  'First names only by design; see the privacy note in this migration.';

-- Verifying, as a signed-in player, against a game you have NOT booked:
--   POST /rest/v1/rpc/get_game_lineup {"p_game_id":"<id>","p_limit":3}
--   -> [{"first_name":"Ali","total":7}, {"first_name":"Ahmed","total":7}, ...]
--
-- And unauthenticated, which must return nothing:
--   -> []
