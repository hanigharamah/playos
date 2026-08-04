-- ============================================================================
-- DEMO DATA, part 2 — a full cohort, past matches, and stats
--
-- Extends 2026-08-demo-fill.sql from 12 players to 35, which is the real
-- launch cohort, and gives them a history so the screens that read backwards
-- have something to read: Activity, XP, streaks and profile stats are all
-- empty against forward-only data.
--
-- Same tagging, same one-line undo:
--   delete from auth.users where email like '%@demo.playos.local';
--   delete from public.games where id like 'demo-%';
--
-- NOT FOR PRODUCTION. Re-runnable.
-- ============================================================================

-- ── 1. Top the cohort up to 35 ──────────────────────────────────────────────
do $$
declare
  firsts text[] := array[
    'Ali','Ahmed','Omar','Faisal','Yousef','Khalid','Saud','Turki','Majed','Bandar',
    'Nawaf','Ziyad','Abdullah','Mishal','Rayan','Salman','Hatim','Fahad','Naif','Badr',
    'Waleed','Tariq','Mansour','Rakan','Sami','Anas','Hassan','Ibrahim','Musaed','Talal',
    'Aziz','Marwan','Sultan','Rashed','Nasser'
  ];
  lasts text[] := array[
    'Al-Harbi','Nasser','Al-Qahtani','Al-Dosari','Al-Otaibi','Al-Shehri','Al-Ghamdi',
    'Al-Mutairi','Al-Zahrani','Al-Subaie','Al-Rashid','Al-Anazi','Al-Amri','Al-Balawi',
    'Al-Juhani'
  ];
  i int; uid uuid; mail text;
begin
  for i in 1 .. array_length(firsts, 1) loop
    mail := 'demo' || i || '@demo.playos.local';
    if not exists (select 1 from auth.users where email = mail) then
      uid := gen_random_uuid();
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
      ) values (
        uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        mail, '', now(), now() - ((60 - i) || ' days')::interval, now(),
        '{"provider":"email"}'::jsonb, '{}'::jsonb
      );
      insert into public.users (id, email, name)
      values (uid, mail, firsts[i] || ' ' || lasts[1 + (i % array_length(lasts,1))])
      on conflict (id) do update set name = excluded.name;
    end if;
    -- Presets on everyone, including the first twelve, so every disc differs.
    update public.users
       set avatar_preset = ((i - 1) % 10) + 1
     where email = mail and avatar_preset is null;
  end loop;
end $$;

-- ── 2. Six weeks of past matches ────────────────────────────────────────────
-- Weekly, so streaks have something continuous to count. Past-dated, which is
-- what keeps them out of Home: useListGames filters on kickoff_time > now().
insert into public.games (id, organiser_id, title, pitch_name, location_text, kickoff_time, price, capacity, status, is_public, duration_minutes)
select 'demo-past-' || w,
       (select u.id from public.users u where u.email not like '%@demo.playos.local' order by u.created_at limit 1),
       'Evening 6v6',
       (array['KAFD Pitch','Arena Riyadh','Al Rowad','King Fahd Arena'])[1 + (w % 4)],
       (array['Al Aqiq','Al Nakheel','Al Olaya','Hittin'])[1 + (w % 4)],
       date_trunc('day', now()) - ((w * 7) || ' days')::interval + interval '20 hours',
       -- games_status_check allows only open/full/cancelled — there is no
       -- 'completed' state, so a played match keeps the status it had. These
       -- are past-dated, which is what actually keeps them out of the feed.
       30, 12, 'full', true, 90
from generate_series(1, 6) as w
on conflict (id) do nothing;

-- ── 3. Who played, checked in, and what they did ────────────────────────────
-- checked_in AND checked_in_at, because the streak reads the timestamp and the
-- check_in RPC never writes it — the reason streaks are zero even for players
-- who did check in. payment_status 'paid' because get_my_activity filters on
-- it, which is the other half of why XP reads zero.
do $$
declare
  w int; p record; n int;
begin
  for w in 1 .. 6 loop
    n := 0;
    for p in
      select u.id from public.users u
       where u.email like '%@demo.playos.local'
       order by md5(u.email || w::text)      -- a different twelve each week
       limit 12
    loop
      if not exists (
        select 1 from public.bookings where game_id = 'demo-past-' || w and user_id = p.id
      ) then
        insert into public.bookings (
          id, game_id, user_id, team, slot_index, payment_status,
          booked_at, checked_in, checked_in_at
        ) values (
          'demo-past-' || w || '-' || n, 'demo-past-' || w, p.id,
          case when n % 2 = 0 then 1 else 2 end, n / 2, 'paid',
          date_trunc('day', now()) - ((w * 7 + 2) || ' days')::interval,
          true,
          date_trunc('day', now()) - ((w * 7) || ' days')::interval + interval '19 hours 45 minutes'
        ) on conflict (id) do nothing;

        insert into public.game_player_stats (game_id, user_id, goals, assists, rating, submitted_at)
        values (
          'demo-past-' || w, p.id,
          (n * 7 + w) % 4,                    -- 0-3 goals
          (n * 3 + w) % 3,                    -- 0-2 assists
          6 + ((n + w) % 5),                  -- 6-10
          date_trunc('day', now()) - ((w * 7) || ' days')::interval + interval '22 hours'
        ) on conflict do nothing;
      end if;
      n := n + 1;
    end loop;
  end loop;
end $$;
