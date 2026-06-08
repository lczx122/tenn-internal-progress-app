-- ============================================================================
--  Permissions — admin vs staff
-- ----------------------------------------------------------------------------
--  Adds a role to each user. Admins can delete records, archive units, and edit
--  the generator's prices. Staff keep all day-to-day create/update abilities.
--  Enforcement is in the database (RLS + a trigger), so it holds even though the
--  anon key is public — hiding buttons in the app is only a convenience layer.
--
--  Run AFTER schema.sql, quotations.sql, sales_orders.sql and appointments.sql.
--  Run ONCE in the SQL Editor. Safe to re-run.
--
--  ▶▶ AFTER running, make yourself an admin (replace the email):
--       update public.profiles set role = 'admin'
--       where id = (select id from auth.users where email = 'you@example.com');
-- ============================================================================

-- 1. Role on every profile (defaults to 'staff').
alter table public.profiles
  add column if not exists role text not null default 'staff';

-- 2. Admin check. SECURITY DEFINER so policies can call it safely.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- 3. Per-command RLS: everyone signed in can read/create/update; only admins
--    can delete. (Replaces the old blanket "for all" policies.)
do $$
declare t text;
begin
  foreach t in array array['jobs','job_works','job_events','appointments'] loop
    execute format('drop policy if exists "auth all %1$s" on public.%1$s', t);
    execute format('drop policy if exists "%1$s select" on public.%1$s', t);
    execute format('drop policy if exists "%1$s insert" on public.%1$s', t);
    execute format('drop policy if exists "%1$s update" on public.%1$s', t);
    execute format('drop policy if exists "%1$s delete" on public.%1$s', t);
    execute format($f$create policy "%1$s select" on public.%1$s for select using (auth.role() = 'authenticated')$f$, t);
    execute format($f$create policy "%1$s insert" on public.%1$s for insert with check (auth.role() = 'authenticated')$f$, t);
    execute format($f$create policy "%1$s update" on public.%1$s for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated')$f$, t);
    execute format($f$create policy "%1$s delete" on public.%1$s for delete using (public.is_admin())$f$, t);
  end loop;
end $$;

-- (older name used in early schema)
drop policy if exists "auth all events" on public.job_events;
drop policy if exists "auth all works"  on public.job_works;

-- Quotations / sales orders: keep read + insert for staff, delete admin-only.
drop policy if exists "auth delete quotations" on public.quotations;
create policy "auth delete quotations" on public.quotations
  for delete using (public.is_admin());

-- 4. Archiving a unit is admin-only (enforced at the row, since it's a column
--    update rather than a delete).
create or replace function public.guard_job_archive()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.is_archived is distinct from old.is_archived and not public.is_admin() then
    raise exception 'Only admins can archive or unarchive units';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_guard_archive on public.jobs;
create trigger jobs_guard_archive before update on public.jobs
  for each row execute function public.guard_job_archive();

-- 5. App settings — holds the admin-editable price overlay (key = 'pricing').
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "settings read"   on public.app_settings;
drop policy if exists "settings insert" on public.app_settings;
drop policy if exists "settings update" on public.app_settings;
create policy "settings read"   on public.app_settings for select using (auth.role() = 'authenticated');
create policy "settings insert" on public.app_settings for insert with check (public.is_admin());
create policy "settings update" on public.app_settings for update using (public.is_admin()) with check (public.is_admin());

do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings') then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;
