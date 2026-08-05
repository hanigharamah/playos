-- ============================================================================
-- One definition of "this seat is taken"
--
-- Three code paths counted occupancy and all three disagreed:
--
--   get_public_game_counts()   payment_status in ('paid','pending')
--                              -> counts EXPIRED holds as occupied, and never
--                                 sweeps them
--   get_game_seatmap()         sweeps expired holds first, then counts
--   mapGameSummary() fallback  payment_status = 'paid' only
--                              -> nothing ever writes 'paid', so always 0
--
-- Measured: a game with two abandoned checkouts reported 2 booked from the
-- games list and 0 from the seat map. lib/api.ts hides any game with no free
-- spots, so two people who opened checkout and wandered off could hide a
-- completely empty, bookable match from the whole storefront for as long as
-- nobody claimed a seat on it.
--
-- The seat map's rule is the correct one: a hold that has expired is not an
-- occupied seat. This makes the games list agree with it.
--
-- Filtered rather than sweeping first, because this function is STABLE and
-- SECURITY DEFINER — it must not write. Filtering gives the same answer the
-- sweep would, without the side effect; release_expired_holds still runs
-- inside claim_spot and get_game_seatmap, which is where the rows actually
-- need tidying.
-- ============================================================================

create or replace function public.get_public_game_counts()
returns table (game_id text, booked_count integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select b.game_id, count(*)::int
  from public.bookings b
  join public.games g on g.id = b.game_id
  where g.is_public = true
    and g.status <> 'cancelled'
    -- Live bookings only. 'refunded' and 'forfeited' are terminal, and
    -- release_expired_holds() writes 'forfeited' when it sweeps — so this
    -- also agrees with a swept row rather than double-counting it.
    and b.payment_status not in ('refunded', 'forfeited')
    -- An unexpired hold occupies its seat; an expired one does not, whether
    -- or not the sweep has got to it yet. This is the clause the seat map
    -- effectively applies by sweeping first.
    and (b.hold_expires_at is null or b.hold_expires_at > now())
  group by b.game_id;
$function$;

comment on function public.get_public_game_counts() is
  'Occupancy for the public games list. MUST agree with get_game_seatmap: a '
  'live booking is one that is not refunded/forfeited and whose hold has not '
  'expired. Changing this rule without changing that one puts a game''s '
  'spots-left count at odds with its own seat picker.';
