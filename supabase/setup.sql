-- ============================================================================
--  Tenn — full database setup (one file)
-- ----------------------------------------------------------------------------
--  Fresh project? Run THIS file once and you're done. It creates everything:
--  profiles & roles, units (jobs) + work categories + activity log, quotations
--  & sales orders, the appointments schedule, admin permissions, and the
--  editable price store. Safe to re-run, and safe to run on an existing project
--  that used the older split migrations (it's all idempotent).
--
--  Supabase → SQL Editor → New query → paste this whole file → Run.
--
--  ▶▶ THEN make yourself an admin (replace the email):
--       update public.profiles set role = 'admin'
--       where id = (select id from auth.users where email = 'you@example.com');
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PROFILES (+ role)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default 'Team member',
  role        text not null default 'staff',   -- 'admin' | 'staff'
  created_at  timestamptz not null default now()
);
alter table public.profiles add column if not exists role text not null default 'staff';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. JOBS (units) + WORK CATEGORIES + ACTIVITY LOG
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id             uuid primary key default gen_random_uuid(),
  customer_name  text not null,
  address        text not null default '',
  phone          text not null default '',
  project        text not null default 'Ambience Pulau Gadong',
  stage          text not null default 'booked',
  key_holder     text not null default 'Office',
  start_date     date,
  target_date    date,
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     text not null default ''
);
alter table public.jobs add column if not exists project text not null default 'Ambience Pulau Gadong';
create index if not exists jobs_updated_at_idx on public.jobs (updated_at desc);
create index if not exists jobs_project_idx    on public.jobs (project);

create table if not exists public.job_events (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.jobs (id) on delete cascade,
  type        text not null default 'note',
  body        text not null default '',
  author_id   uuid references public.profiles (id),
  author_name text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists job_events_job_idx on public.job_events (job_id, created_at desc);

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

-- ---------------------------------------------------------------------------
-- 3. QUOTATIONS & SALES ORDERS  (QT-YYMM-XXX / SO-YYMM-XXX)
-- ---------------------------------------------------------------------------
create table if not exists public.quotations (
  id             uuid primary key default gen_random_uuid(),
  number         text not null unique,
  doc_type       text not null default 'QT',     -- 'QT' | 'SO'
  source_id      uuid references public.quotations (id),
  yymm           text not null,
  seq            int  not null,
  customer_name  text not null default '',
  customer_phone text not null default '',
  unit           text not null default '',
  prepared_by    text not null default '',
  categories     text not null default '',
  total          numeric not null default 0,
  payload        jsonb not null default '{}'::jsonb,
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now()
);
alter table public.quotations add column if not exists doc_type  text not null default 'QT';
alter table public.quotations add column if not exists source_id uuid references public.quotations (id);
create index if not exists quotations_created_idx  on public.quotations (created_at desc);
create index if not exists quotations_doc_type_idx on public.quotations (doc_type, created_at desc);
-- one sequence per (type, month)
alter table public.quotations drop constraint if exists quotations_yymm_seq_key;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quotations_type_yymm_seq_key') then
    alter table public.quotations add constraint quotations_type_yymm_seq_key unique (doc_type, yymm, seq);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. APPOINTMENTS (schedule)
-- ---------------------------------------------------------------------------
create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  title           text not null default '',
  type            text not null default 'site_visit',
  job_id          uuid references public.jobs (id) on delete set null,
  customer_name   text not null default '',
  location        text not null default '',
  who             text not null default '',
  assigned_to     uuid references public.profiles (id),
  assignee_ids    uuid[] not null default '{}',
  starts_at       timestamptz not null,
  ends_at         timestamptz,
  status          text not null default 'scheduled',
  notes           text not null default '',
  created_by      uuid references public.profiles (id),
  created_by_name text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.appointments add column if not exists assigned_to uuid references public.profiles (id);
alter table public.appointments add column if not exists assignee_ids uuid[] not null default '{}';
create index if not exists appointments_starts_idx    on public.appointments (starts_at);
create index if not exists appointments_job_idx       on public.appointments (job_id);
create index if not exists appointments_assigned_idx  on public.appointments (assigned_to);
create index if not exists appointments_assignees_idx on public.appointments using gin (assignee_ids);

-- ---------------------------------------------------------------------------
-- 5. APP SETTINGS (admin-editable price overlay, key = 'pricing')
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- Costing (Boss-only): one row per cash sale.
create table if not exists public.costings (
  id            uuid primary key default gen_random_uuid(),
  cash_sale_no  text not null default '',
  category      text not null default '',
  customer      text not null default '',
  costing_date  date,
  revenue       numeric not null default 0,
  costs         jsonb not null default '[]'::jsonb,
  commissions   jsonb not null default '[]'::jsonb,
  shares        jsonb not null default '[]'::jsonb,
  notes         text not null default '',
  status        text not null default 'draft',
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
alter table public.costings add column if not exists category text not null default '';
create index if not exists costings_cash_idx     on public.costings (cash_sale_no);
create index if not exists costings_created_idx  on public.costings (created_at desc);
create index if not exists costings_category_idx on public.costings (category);

-- ---------------------------------------------------------------------------
-- 6. FUNCTIONS & TRIGGERS
-- ---------------------------------------------------------------------------
create or replace function public.touch_job()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs
  for each row execute function public.touch_job();
drop trigger if exists job_works_touch on public.job_works;
create trigger job_works_touch before update on public.job_works
  for each row execute function public.touch_job();
drop trigger if exists appointments_touch on public.appointments;
create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();
drop trigger if exists costings_touch on public.costings;
create trigger costings_touch before update on public.costings
  for each row execute function public.touch_updated_at();

-- who is an admin? (bosses inherit all admin powers)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','boss')); $$;

-- who is a boss? (gates the Costing area)
create or replace function public.is_boss()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'boss'); $$;

-- archive is admin-only (it's a column update, not a delete)
create or replace function public.guard_job_archive()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.is_archived is distinct from old.is_archived and not public.is_admin() then
    raise exception 'Only admins can archive or unarchive units';
  end if;
  return new;
end; $$;
drop trigger if exists jobs_guard_archive on public.jobs;
create trigger jobs_guard_archive before update on public.jobs
  for each row execute function public.guard_job_archive();

-- role changes are admin-only (blocks self-promotion via the own-profile policy)
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- auth.uid() is null in the SQL editor / service role (which bypass RLS
  -- anyway), so only guard changes made by an actual signed-in API user.
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  return new;
end; $$;
drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

create or replace function public.set_role(target uuid, new_role text)
returns void language plpgsql security definer set search_path = public
as $$
declare cur text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if new_role not in ('admin','staff','boss') then raise exception 'Invalid role: %', new_role; end if;
  select role into cur from public.profiles where id = target;
  if (new_role = 'boss' or cur = 'boss') and not public.is_boss() then
    raise exception 'Only a boss can assign or change the boss role';
  end if;
  if new_role = 'staff' and cur in ('admin','boss')
     and (select count(*) from public.profiles where role in ('admin','boss')) <= 1 then
    raise exception 'Cannot remove the last admin/boss';
  end if;
  update public.profiles set role = new_role where id = target;
end; $$;

create or replace function public.set_full_name(target uuid, name text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if coalesce(btrim(name), '') = '' then raise exception 'Name required'; end if;
  update public.profiles set full_name = btrim(name) where id = target;
end; $$;

-- create a quotation or sales order with an atomic per-type monthly sequence
create or replace function public.create_document(
  p_type text, p_payload jsonb, p_customer text, p_phone text, p_unit text,
  p_prepared_by text, p_categories text, p_total numeric, p_source uuid default null
) returns public.quotations
language plpgsql security definer set search_path = public
as $$
declare
  v_type text := upper(coalesce(p_type, 'QT'));
  v_yymm text := to_char(now(), 'YYMM');
  v_seq  int;
  v_row  public.quotations;
begin
  if auth.role() <> 'authenticated' then raise exception 'Not authorised'; end if;
  if v_type not in ('QT', 'SO') then raise exception 'Invalid document type: %', v_type; end if;
  perform pg_advisory_xact_lock(hashtext('tenn_doc_' || v_type || '_' || v_yymm));
  select coalesce(max(seq), 0) + 1 into v_seq from public.quotations where doc_type = v_type and yymm = v_yymm;
  insert into public.quotations
    (number, doc_type, source_id, yymm, seq, customer_name, customer_phone, unit,
     prepared_by, categories, total, payload, created_by)
  values
    (v_type || '-' || v_yymm || '-' || lpad(v_seq::text, 3, '0'), v_type, p_source, v_yymm, v_seq,
     coalesce(p_customer, ''), coalesce(p_phone, ''), coalesce(p_unit, ''), coalesce(p_prepared_by, ''),
     coalesce(p_categories, ''), coalesce(p_total, 0), coalesce(p_payload, '{}'::jsonb), auth.uid())
  returning * into v_row;
  return v_row;
end; $$;

create or replace function public.create_quotation(
  p_payload jsonb, p_customer text, p_phone text, p_unit text,
  p_prepared_by text, p_categories text, p_total numeric
) returns public.quotations
language plpgsql security definer set search_path = public
as $$
begin
  return public.create_document('QT', p_payload, p_customer, p_phone, p_unit,
                                p_prepared_by, p_categories, p_total, null);
end; $$;

-- ---------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
--    Everyone signed in can read/create/update; only admins can delete.
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.jobs         enable row level security;
alter table public.job_events   enable row level security;
alter table public.job_works    enable row level security;
alter table public.quotations   enable row level security;
alter table public.appointments enable row level security;
alter table public.costings    enable row level security;
drop policy if exists "boss all costings" on public.costings;
create policy "boss all costings" on public.costings
  for all using (public.is_boss()) with check (public.is_boss());

alter table public.app_settings enable row level security;

drop policy if exists "auth read profiles"       on public.profiles;
drop policy if exists "auth update own profile"  on public.profiles;
create policy "auth read profiles"      on public.profiles for select using (auth.role() = 'authenticated');
create policy "auth update own profile" on public.profiles for update using (auth.uid() = id);

-- jobs / job_works / job_events / appointments: select+insert+update for all, delete admin-only
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

-- quotations / sales orders: read + create for staff, delete admin-only
drop policy if exists "auth read quotations"   on public.quotations;
drop policy if exists "auth insert quotations" on public.quotations;
drop policy if exists "auth delete quotations" on public.quotations;
create policy "auth read quotations"   on public.quotations for select using (auth.role() = 'authenticated');
create policy "auth insert quotations" on public.quotations for insert with check (auth.role() = 'authenticated');
create policy "auth delete quotations" on public.quotations for delete using (public.is_admin());

-- price store: everyone reads, admins write
drop policy if exists "settings read"   on public.app_settings;
drop policy if exists "settings insert" on public.app_settings;
drop policy if exists "settings update" on public.app_settings;
create policy "settings read"   on public.app_settings for select using (auth.role() = 'authenticated');
create policy "settings insert" on public.app_settings for insert with check (public.is_admin());
create policy "settings update" on public.app_settings for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. REALTIME
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['jobs','job_events','job_works','appointments','quotations','app_settings','costings'] loop
    if not exists (select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
