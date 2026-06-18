-- ============================================================================
--  Unit revamp — richer unit details, admin-managed projects, customer claims
-- ----------------------------------------------------------------------------
--  Adds structured customer / house-type / PIC / key-holder fields to units,
--  an admin-managed `projects` list, an `order_total` per unit and a `claims`
--  ledger that tracks money collected from the customer.
--
--  Non-destructive: existing data is preserved. The old free-text unit code
--  (stored in jobs.customer_name) is COPIED into the new jobs.unit_code so
--  nothing is lost; existing room-type text stays in jobs.address.
--
--  Run ONCE in Supabase: SQL Editor -> New query -> paste -> Run. Safe to re-run.
-- ============================================================================

-- 1. New unit columns -------------------------------------------------------
alter table public.jobs
  add column if not exists unit_code         text    not null default '',
  add column if not exists is_owner          boolean not null default true,
  add column if not exists owner_relationship text   not null default '',
  add column if not exists house_types       text[]  not null default '{}',
  add column if not exists pic               text    not null default '',
  add column if not exists key_holder_type   text    not null default '',
  add column if not exists order_total       numeric not null default 0;

-- Backfill the unit code from the legacy customer_name field (only where blank,
-- so re-running never clobbers edited data).
update public.jobs set unit_code = customer_name
  where unit_code = '' and customer_name <> '';

-- 2. Admin-managed projects -------------------------------------------------
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- Seed from project names already in use, plus the historic default.
insert into public.projects (name)
  select distinct project from public.jobs where coalesce(btrim(project), '') <> ''
  on conflict (name) do nothing;
insert into public.projects (name) values ('Ambience Pulau Gadong')
  on conflict (name) do nothing;

alter table public.projects enable row level security;
drop policy if exists "auth read projects"   on public.projects;
drop policy if exists "admin write projects"  on public.projects;
create policy "auth read projects" on public.projects
  for select using (auth.role() = 'authenticated');
-- Only admins may add / rename / remove projects.
create policy "admin write projects" on public.projects
  for all using (public.is_admin()) with check (public.is_admin());

-- 3. Customer claims ledger -------------------------------------------------
create table if not exists public.claims (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references public.jobs (id) on delete cascade,
  category        text not null default 'Custom',  -- matches CLAIM_CATEGORIES
  amount          numeric not null default 0,       -- resolved RM collected
  percent         numeric,                          -- set when entered as a %
  note            text not null default '',
  collected_on    date,
  created_by      uuid references public.profiles (id),
  created_by_name text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists claims_job_idx on public.claims (job_id);

alter table public.claims enable row level security;
drop policy if exists "auth read claims"   on public.claims;
drop policy if exists "auth write claims"  on public.claims;
create policy "auth read claims" on public.claims
  for select using (auth.role() = 'authenticated');
create policy "auth write claims" on public.claims
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 4. Live updates -----------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projects') then
    alter publication supabase_realtime add table public.projects;
  end if;
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'claims') then
    alter publication supabase_realtime add table public.claims;
  end if;
end $$;
