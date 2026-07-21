-- ============================================================================
-- PlayOS mobile redesign — backend support for the mockup's screens
-- Run in Supabase SQL editor. Safe to run more than once.
--
-- Adds:
--   1. pitches.photo_url        — venue photos (Home/Play/match-detail cards)
--   2. games.winning_team       — lets an operator record who won, which
--                                  powers the Profile screen's Matches/Won/
--                                  Win-rate stats (previously impossible —
--                                  there was no result-tracking at all)
--   3. Chat: conversations, conversation_participants, messages — one
--      auto-created group conversation per game (the mockup's "Groups" tab).
--      Direct messages ("Messages" tab) share the same schema but need a
--      "start a DM" entry point in the app before they're reachable — the
--      table/RLS support it, the UI flow for 1:1 doesn't exist yet.
-- ============================================================================

-- ── 1. Venue photos ─────────────────────────────────────────────────────────
alter table public.pitches
  add column if not exists photo_url text;

comment on column public.pitches.photo_url is
  'Venue photo shown on Home/Play/match-detail cards. NULL falls back to a generic stock photo client-side until real photos are uploaded per venue.';

-- ── 2. Match results (powers Profile stats) ─────────────────────────────────
alter table public.games
  add column if not exists winning_team smallint
    check (winning_team is null or winning_team in (1, 2));

comment on column public.games.winning_team is
  'Set by the operator after the match (1, 2, or NULL for unrecorded/draw). Used to compute each player''s win rate — there was no result tracking before this.';

-- Per-player stats, safe to expose to any authenticated user for their own id
-- (checked via auth.uid() inside the function, not passed blind from the client).
create or replace function public.get_my_stats()
returns table (games_played integer, games_won integer, win_rate numeric)
language sql
security definer
set search_path = public
as $$
  select
    count(*)::int as games_played,
    count(*) filter (where b.team = g.winning_team)::int as games_won,
    case when count(*) filter (where g.winning_team is not null) > 0
      then round(
        100.0 * count(*) filter (where b.team = g.winning_team)
        / count(*) filter (where g.winning_team is not null)
      )
      else 0
    end as win_rate
  from public.bookings b
  join public.games g on g.id = b.game_id
  where b.user_id = auth.uid()
    and b.payment_status = 'paid';
$$;

grant execute on function public.get_my_stats() to authenticated;

-- ── 3. Chat ──────────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('direct', 'game_group')),
  game_id     uuid references public.games(id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- one group conversation per game, at most
  unique (kind, game_id)
);

create table if not exists public.conversation_participants (
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  joined_at        timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.conversations(id) on delete cascade,
  sender_id         uuid not null references auth.users(id) on delete cascade,
  body              text not null check (char_length(trim(body)) > 0),
  created_at        timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations: participants can read" on public.conversations;
create policy "conversations: participants can read"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "participants: can read own conversations' rosters" on public.conversation_participants;
create policy "participants: can read own conversations' rosters"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants cp2
      where cp2.conversation_id = conversation_id and cp2.user_id = auth.uid()
    )
  );

drop policy if exists "messages: participants can read" on public.messages;
create policy "messages: participants can read"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "messages: participants can send" on public.messages;
create policy "messages: participants can send"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

-- Auto-creates (or returns) the group chat for a game, and adds the caller as
-- a participant IF they have a paid or pending booking for that game. This is
-- the entry point the "Groups" tab and the game-detail screen call — chat
-- access is earned by booking, not open to anyone.
create or replace function public.get_or_create_game_chat(p_game_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_has_booking boolean;
begin
  select exists (
    select 1 from public.bookings
    where game_id = p_game_id
      and user_id = auth.uid()
      and payment_status in ('paid', 'pending')
  ) into v_has_booking;

  if not v_has_booking then
    raise exception 'Book a spot in this game before joining its chat';
  end if;

  insert into public.conversations (kind, game_id)
  values ('game_group', p_game_id)
  on conflict (kind, game_id) do nothing;

  select id into v_conversation_id
  from public.conversations
  where kind = 'game_group' and game_id = p_game_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conversation_id, auth.uid())
  on conflict do nothing;

  return v_conversation_id;
end;
$$;

grant execute on function public.get_or_create_game_chat(uuid) to authenticated;

-- ── Report ───────────────────────────────────────────────────────────────────
select 'pitches.photo_url' as item, count(*) as ok
  from information_schema.columns where table_name = 'pitches' and column_name = 'photo_url'
union all
select 'games.winning_team', count(*)
  from information_schema.columns where table_name = 'games' and column_name = 'winning_team'
union all
select 'conversations table', count(*)
  from information_schema.tables where table_name = 'conversations'
union all
select 'messages table', count(*)
  from information_schema.tables where table_name = 'messages'
union all
select 'get_my_stats() fn', count(*)
  from information_schema.routines where routine_name = 'get_my_stats'
union all
select 'get_or_create_game_chat() fn', count(*)
  from information_schema.routines where routine_name = 'get_or_create_game_chat';
