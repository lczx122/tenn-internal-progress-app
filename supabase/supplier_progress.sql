-- ============================================================================
--  Supplier progress tracker — per unit, BOSS-ONLY
-- ----------------------------------------------------------------------------
--  A per-unit list of suppliers fulfilling that unit's materials/products, each
--  with a status (To Order → Ordered → In Production → Delivered → Installed),
--  the RM cost paid to that supplier, an expected date, and notes. Visible and
--  editable ONLY to the boss (RLS via public.is_boss()).
--
--  Requires public.is_boss() and public.touch_updated_at() (from costing.sql /
--  appointments.sql). Run ONCE in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

create table if not exists public.unit_suppliers (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references public.jobs (id) on delete cascade,
  supplier      text not null default '',
  item          text not null default '',
  -- supplier stage key: to_order | ordered | in_production | delivered | installed
  stage         text not null default 'to_order',
  cost          numeric not null default 0,          -- RM paid to this supplier
  expected_date date,
  notes         text not null default '',
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists unit_suppliers_job_idx on public.unit_suppliers (job_id);

-- keep updated_at fresh
drop trigger if exists unit_suppliers_touch on public.unit_suppliers;
create trigger unit_suppliers_touch before update on public.unit_suppliers
  for each row execute function public.touch_updated_at();

-- Boss-only: non-boss users get zero rows and cannot write.
alter table public.unit_suppliers enable row level security;
drop policy if exists "boss all unit_suppliers" on public.unit_suppliers;
create policy "boss all unit_suppliers" on public.unit_suppliers
  for all using (public.is_boss()) with check (public.is_boss());

-- live updates so the tracker stays in sync across the boss's devices
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'unit_suppliers') then
    alter publication supabase_realtime add table public.unit_suppliers;
  end if;
end $$;
