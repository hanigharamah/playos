-- ============================================================================
-- PlayOS MVP migration
-- Run this in the Supabase SQL editor for the project the app points at
-- (VITE_SUPABASE_URL). Safe to run more than once.
-- ============================================================================

-- ── Global app settings (single row) ───────────────────────────────────────
create table if not exists public.app_settings (
  id            int primary key default 1,
  booking_fee   numeric not null default 30,
  whatsapp_url  text,
  stcpay_number text,
  stcpay_link   text,
  guidelines    text,
  updated_at    timestamptz not null default now(),
  constraint app_settings_single_row check (id = 1)
);

insert into public.app_settings (id) values (1)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

-- Anyone (including anonymous players) can read settings: booking fee,
-- WhatsApp link and guidelines are shown publicly.
drop policy if exists app_settings_read_all on public.app_settings;
create policy app_settings_read_all
  on public.app_settings for select
  using (true);

-- Only the operator (role host/admin) can change settings.
drop policy if exists app_settings_write_admin on public.app_settings;
create policy app_settings_write_admin
  on public.app_settings for update
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role <> 'player'
    )
  );

-- ── Track how each booking is being paid ────────────────────────────────────
alter table public.bookings
  add column if not exists payment_method text;  -- 'stcpay' | 'cash' | null
