-- ============================================================
-- PlayOS — Supabase schema + auth wiring
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. TABLES
-- Users table linked to Supabase Auth
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text unique,
  phone         text,
  name          text not null,
  role          text not null default 'player'
                  check (role in ('player', 'organiser', 'host', 'admin')),
  created_at    timestamptz not null default now()
);

create table if not exists public.pitches (
  id           text primary key,
  organiser_id uuid not null references public.users(id) on delete cascade,
  name         text not null,
  maps_url     text,
  created_at   timestamptz not null default now()
);

create table if not exists public.games (
  id                text primary key,
  organiser_id      uuid not null references public.users(id) on delete cascade,
  title             text not null,
  pitch_name        text not null,
  location_text     text,
  kickoff_time      timestamptz not null,
  price             numeric(10, 2) not null,
  capacity          integer not null,
  status            text not null default 'open'
                      check (status in ('open', 'full', 'cancelled')),
  auto_cancel_hours integer not null default 4,
  duration_minutes  integer not null default 60,
  is_public         boolean not null default true,
  maps_url          text,
  latitude          numeric(10, 6),
  longitude         numeric(10, 6),
  created_at        timestamptz not null default now()
);

create table if not exists public.bookings (
  id             text primary key,
  game_id        text not null references public.games(id) on delete cascade,
  user_id        uuid not null references public.users(id) on delete cascade,
  team           integer not null,
  slot_index     integer not null,
  payment_status text not null default 'pending'
                   check (payment_status in ('pending', 'paid', 'refunded')),
  payment_id     text,
  booked_at      timestamptz not null default now(),
  checked_in     boolean not null default false,
  checked_in_at  timestamptz
);

create table if not exists public.host_applications (
  id         text primary key,
  name       text not null,
  pitch_name text not null,
  phone      text not null,
  city       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.host_payout_details (
  organiser_id   uuid primary key references public.users(id) on delete cascade,
  account_holder text not null,
  iban           text not null,
  bank_name      text,
  swift          text,
  updated_at     timestamptz not null default now()
);

create table if not exists public.login_events (
  id         text primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  ip         text,
  user_agent text,
  created_at timestamptz not null default now()
);


-- 2. AUTH TRIGGER
-- Auto-create a user profile row when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'player')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 3. HELPER RPC (used by host login to find email by phone)
create or replace function public.get_user_email_by_phone(user_phone text)
returns text
language sql
security definer
set search_path = public
as $$
  select email from public.users where phone = user_phone limit 1;
$$;


-- 4. ROW LEVEL SECURITY
alter table public.users              enable row level security;
alter table public.games              enable row level security;
alter table public.bookings           enable row level security;
alter table public.pitches            enable row level security;
alter table public.host_applications  enable row level security;
alter table public.host_payout_details enable row level security;
alter table public.login_events       enable row level security;

-- Users
create policy "users: read own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "users: update own profile"
  on public.users for update
  using (auth.uid() = id);

-- Allow the trigger (security definer) to insert — no RLS needed for that

-- Games
create policy "games: public read"
  on public.games for select
  using (is_public = true or organiser_id = auth.uid());

create policy "games: organiser insert"
  on public.games for insert
  with check (organiser_id = auth.uid());

create policy "games: organiser update"
  on public.games for update
  using (organiser_id = auth.uid());

create policy "games: organiser delete"
  on public.games for delete
  using (organiser_id = auth.uid());

-- Bookings
create policy "bookings: read own or organiser"
  on public.bookings for select
  using (
    user_id = auth.uid()
    or game_id in (select id from public.games where organiser_id = auth.uid())
  );

create policy "bookings: authenticated insert"
  on public.bookings for insert
  with check (user_id = auth.uid());

create policy "bookings: update own or organiser"
  on public.bookings for update
  using (
    user_id = auth.uid()
    or game_id in (select id from public.games where organiser_id = auth.uid())
  );

-- Pitches
create policy "pitches: read own"
  on public.pitches for select
  using (organiser_id = auth.uid());

create policy "pitches: insert own"
  on public.pitches for insert
  with check (organiser_id = auth.uid());

-- Host applications
create policy "host_applications: anyone can insert"
  on public.host_applications for insert
  with check (true);

-- Host payout details
create policy "payouts: read own"
  on public.host_payout_details for select
  using (organiser_id = auth.uid());

create policy "payouts: upsert own"
  on public.host_payout_details for insert
  with check (organiser_id = auth.uid());

create policy "payouts: update own"
  on public.host_payout_details for update
  using (organiser_id = auth.uid());
