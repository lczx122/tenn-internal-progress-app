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
  stage          text not null default 'not_started',
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
-- 4. JOB_PHOTOS
--    Metadata for progress photos. The file itself lives in Storage.
-- ---------------------------------------------------------------------------
create table if not exists public.job_photos (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid not null references public.jobs (id) on delete cascade,
  storage_path text not null,
  caption      text not null default '',
  author_name  text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists job_photos_job_idx on public.job_photos (job_id, created_at desc);

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

-- ---------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
--    All 6+ staff are trusted internal users: any signed-in user can read and
--    write everything. Anonymous (logged-out) visitors get nothing.
-- ---------------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.jobs       enable row level security;
alter table public.job_events enable row level security;
alter table public.job_photos enable row level security;

drop policy if exists "auth read profiles"  on public.profiles;
drop policy if exists "auth all jobs"        on public.jobs;
drop policy if exists "auth all events"      on public.job_events;
drop policy if exists "auth all photos"      on public.job_photos;
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

-- ---------------------------------------------------------------------------
-- 6. REALTIME
--    Broadcast changes so every phone updates live.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.job_events;
alter publication supabase_realtime add table public.job_photos;

-- ---------------------------------------------------------------------------
-- 7. STORAGE (photos)
--    Creates a private bucket "job-photos" and lets signed-in users use it.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

drop policy if exists "auth read photos"   on storage.objects;
drop policy if exists "auth upload photos" on storage.objects;
drop policy if exists "auth delete photos" on storage.objects;

create policy "auth read photos" on storage.objects
  for select using (bucket_id = 'job-photos' and auth.role() = 'authenticated');
create policy "auth upload photos" on storage.objects
  for insert with check (bucket_id = 'job-photos' and auth.role() = 'authenticated');
create policy "auth delete photos" on storage.objects
  for delete using (bucket_id = 'job-photos' and auth.role() = 'authenticated');
