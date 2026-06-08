-- ============================================================================
--  Reno Tracker — Supabase schema
-- ----------------------------------------------------------------------------
--  Run this ONCE in your Supabase project:
--    Dashboard -> SQL Editor -> New query -> paste this whole file -> Run.
--  It is safe to re-run (everything is "if not exists" / "or replace").
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES
--    One row per user. Auto-created when you add a user in the Supabase
--    dashboard. Stores the display name so we can show "who updated it".
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default 'Team member',
  created_at  timestamptz not null default now()
);

-- When a new auth user is created, copy their name (from user metadata or
-- email) into the profiles table automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. JOBS
--    One row per customer / renovation site. This is your "spreadsheet row".
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id             uuid primary key default gen_random_uuid(),
  customer_name  text not null,
  address        text not null default '',
  phone          text not null default '',
  -- Current stage key, matches src/lib/stages.ts
  stage          text not null default 'booked',
  key_holder     text not null default 'Office',
  start_date     date,
  target_date    date,
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     text not null default ''
);

create index if not exists jobs_updated_at_idx on public.jobs (updated_at desc);

-- ---------------------------------------------------------------------------
-- 3. JOB_EVENTS
--    The timeline / audit log for each job. Every stage change, key handover,
--    and note becomes one row here, stamped with who + when.
-- ---------------------------------------------------------------------------
create table if not exists public.job_events (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  -- 'note' | 'stage' | 'key' | 'created'
  type        text not null default 'note',
  body        text not null default '',
  author_id   uuid references public.profiles (id),
  author_name text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists job_events_job_idx on public.job_events (job_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4b. JOB_WORKS
--    One row per work category on a unit (Mindhome, Aluminium, EE, Smart Home,
--    Smart Lock, Products). Each category tracks its OWN stage independently.
-- ---------------------------------------------------------------------------
create table if not exists public.job_works (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  category    text not null,
  title       text not null default '',
  stage       text not null default 'booked',
  remarks     text not null default '',
  updated_by  text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists job_works_job_idx on public.job_works (job_id);

-- Keep jobs.updated_at fresh on every change.
create or replace function public.touch_job()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_job();

drop trigger if exists job_works_touch on public.job_works;
create trigger job_works_touch before update on public.job_works
  for each row execute function public.touch_job();

-- ---------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
--    All 6+ staff are trusted internal users: any signed-in user can read and
--    write everything. Anonymous (logged-out) visitors get nothing.
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.jobs       enable row level security;
alter table public.job_events enable row level security;
alter table public.job_works  enable row level security;

drop policy if exists "auth read profiles"  on public.profiles;
drop policy if exists "auth all jobs"        on public.jobs;
drop policy if exists "auth all events"      on public.job_events;
drop policy if exists "auth all works"       on public.job_works;
drop policy if exists "auth update own profile" on public.profiles;

create policy "auth read profiles" on public.profiles
  for select using (auth.role() = 'authenticated');
create policy "auth update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "auth all jobs" on public.jobs
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "auth all events" on public.job_events
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "auth all photos" on public.job_photos
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "auth all works" on public.job_works
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 6. REALTIME
--    Broadcast changes so every phone updates live. Wrapped in a guard so the
--    script is safe to re-run (adding a table that's already published errors).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs') then
    alter publication supabase_realtime add table public.jobs;
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'job_events') then
    alter publication supabase_realtime add table public.job_events;
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'job_works') then
    alter publication supabase_realtime add table public.job_works;
  end if;
end $$;
