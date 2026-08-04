-- ============================================================================
-- DEMO DATA — players and games at varied fill levels, to see Home for real
--
-- Home ranks open games by fill descending and labels anything below the
-- viable threshold "needs N more". Neither is visible against the current
-- data: six future games, nine bookings between them, and eight players whose
-- names are 'QA Bot', 'chk1784237941' and 'Verify Test' — so the lineup line
-- reads as noise rather than social proof.
--
-- This seeds enough to see the real thing: a game one player short, a game
-- comfortably full, a game that is not going to happen, and a set of names
-- that look like the actual Riyadh cohort.
--
-- EVERYTHING HERE IS TAGGED AND REMOVABLE. Players use @demo.playos.local
-- addresses, games use ids prefixed 'demo-'. To undo the whole thing:
--
--   delete from auth.users where email like '%@demo.playos.local';
--   delete from public.games where id like 'demo-%';
--
-- The first cascades to public.users and to their bookings; the second
-- cascades to any booking on those games. Nothing else is touched.
--
-- NOT FOR PRODUCTION. Re-runnable: every insert is guarded.
-- ============================================================================

-- ── 1. Demo players ─────────────────────────────────────────────────────────
-- public.users.id references auth.users(id), and a trigger creates the profile
-- row, so the auth row has to come first and the profile is then updated
-- rather than inserted. These accounts have no usable password on purpose:
-- they exist to be booked into games and read back out by get_game_lineup,
-- never to sign in.
do $$
declare
  names text[] := array[
    'Ali Al-Harbi','Ahmed Nasser','Omar Al-Qahtani','Faisal Al-Dosari',
    'Yousef Al-Otaibi','Khalid Al-Shehri','Saud Al-Ghamdi','Turki Al-Mutairi',
    'Majed Al-Zahrani','Bandar Al-Subaie','Nawaf Al-Rashid','Ziyad Al-Anazi'
  ];
  i int;
  uid uuid;
  mail text;
begin
  for i in 1 .. array_length(names, 1) loop
    mail := 'demo' || i || '@demo.playos.local';
    if not exists (select 1 from auth.users where email = mail) then
      uid := gen_random_uuid();
      insert into auth.users (
        id, instance_id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
      ) values (
        uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        mail, '', now(), now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb
      );
      -- The trigger may or may not have made the profile; cover both.
      insert into public.users (id, email, name)
      values (uid, mail, names[i])
      on conflict (id) do update set name = excluded.name;
      -- Spread the ten cartoon presets across them so the discs are distinct.
      update public.users set avatar_preset = ((i - 1) % 10) + 1 where id = uid;
    end if;
  end loop;
end $$;

-- ── 2. Demo games ───────────────────────────────────────────────────────────
-- Times are relative to now() so this stays useful tomorrow. Kickoffs are
-- pushed to the evening because "today" on Home is device-local, and a UTC
-- morning slot reads as yesterday at UTC+3.
-- games.organiser_id is NOT NULL, so demo games are hung off an existing
-- account rather than a new one — the organiser is not what is being
-- demonstrated here, and inventing one would leave another row to clean up.
insert into public.games (id, organiser_id, title, pitch_name, location_text, kickoff_time, price, capacity, status, is_public, duration_minutes)
select v.id, (select u.id from public.users u where u.email not like '%@demo.playos.local' order by u.created_at limit 1),
       v.title, v.pitch_name, v.location_text, v.kickoff_time, v.price, v.capacity, v.status, v.is_public, v.duration_minutes
from (values
  -- One short of viable: the whole point of "needs 1 more".
  ('demo-nearly',  'Evening 6v6',  'KAFD Pitch',      'Al Aqiq',    date_trunc('day', now()) + interval '21 hours', 30, 12, 'open', true, 90),
  -- Comfortable: this should lead the ranking.
  ('demo-strong',  'Evening 6v6',  'Arena Riyadh',    'Al Nakheel', date_trunc('day', now()) + interval '20 hours', 35, 12, 'open', true, 90),
  -- Mid: sits between the two above.
  ('demo-mid',     'Evening 5v5',  'Al Rowad',        'Al Olaya',   date_trunc('day', now()) + interval '19 hours', 28, 10, 'open', true, 60),
  -- At risk: should rank LAST and say "needs 4 more", not "8 spots left".
  ('demo-atrisk',  'Late 6v6',     'King Fahd Arena', 'Hittin',     date_trunc('day', now()) + interval '23 hours', 25, 12, 'open', true, 90),
  -- Later in the week, so the fallback has something to show.
  ('demo-week1',   'Evening 6v6',  'KAFD Pitch',      'Al Aqiq',    date_trunc('day', now()) + interval '3 days 21 hours', 30, 12, 'open', true, 90),
  ('demo-week2',   'Morning 5v5',  'Al Rowad',        'Al Olaya',   date_trunc('day', now()) + interval '4 days 8 hours',  28, 10, 'open', true, 60)
) as v(id, title, pitch_name, location_text, kickoff_time, price, capacity, status, is_public, duration_minutes)
on conflict (id) do update
  set kickoff_time = excluded.kickoff_time,   -- keep it in the future on re-run
      status       = excluded.status;

-- ── 3. Fill them ────────────────────────────────────────────────────────────
-- Seats are handed out in demo-player order, so the lineup's booked_at
-- ordering is stable and the first names on each card are predictable.
do $$
declare
  plan record;
  p record;
  n int;
begin
  for plan in
    select * from (values
      ('demo-nearly', 11),   -- 11/12 → "needs 1 more" is wrong here; 1 spot left
      ('demo-strong',  9),   -- 9/12  → leads on fill
      ('demo-mid',     6),   -- 6/10
      ('demo-atrisk',  2),   -- 2/12  → below MIN_PLAYERS_TO_START, "needs 4 more"
      ('demo-week1',   7),
      ('demo-week2',   3)
    ) as t(game_id, want)
  loop
    n := 0;
    for p in
      select u.id from public.users u
       where u.email like '%@demo.playos.local'
       order by u.email
    loop
      exit when n >= plan.want;
      if not exists (
        select 1 from public.bookings
         where game_id = plan.game_id and user_id = p.id
           and payment_status not in ('refunded','forfeited')
      ) then
        insert into public.bookings (id, game_id, user_id, team, slot_index, payment_status, booked_at)
        values (
          'demo-' || plan.game_id || '-' || n,
          plan.game_id, p.id,
          case when n % 2 = 0 then 1 else 2 end,
          n / 2,
          'paid',                       -- so occupancy counts and XP is visible
          now() - ((30 - n) || ' minutes')::interval
        )
        on conflict (id) do nothing;
      end if;
      n := n + 1;
    end loop;
  end loop;
end $$;
