-- ============================================================================
--  Appointments — shared team schedule
-- ----------------------------------------------------------------------------
--  Site visits, measurements, installations, meetings and collections. Each
--  appointment can optionally link to a unit (job). Same trust model as the
--  rest of the app: any signed-in staff can read/write; realtime on.
--
--  Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run.
--  Safe to re-run.
-- ============================================================================

create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  title           text not null default '',
  -- site_visit | measurement | installation | meeting | collection | other
  type            text not null default 'site_visit',
  job_id          uuid references public.jobs (id) on delete set null,
  customer_name   text not null default '',
  location        text not null default '',
  who             text not null default '',           -- free-text assignee
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  -- scheduled | done | cancelled
  status          text not null default 'scheduled',
  notes           text not null default '',
  created_by      uuid references public.profiles (id),
  created_by_name text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists appointments_starts_idx on public.appointments (starts_at);
create index if not exists appointments_job_idx     on public.appointments (job_id);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

alter table public.appointments enable row level security;

drop policy if exists "auth all appointments" on public.appointments;
create policy "auth all appointments" on public.appointments
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- live updates so the schedule stays in sync on every phone
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments') then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;
