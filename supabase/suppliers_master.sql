-- ============================================================================
--  Supplier tracker v2 — reusable supplier master list + per-entry trade
-- ----------------------------------------------------------------------------
--  Extends supplier_progress.sql:
--    1. public.suppliers — a boss-only master list of supplier names, so a
--       supplier typed on one unit autocompletes on every other unit.
--    2. unit_suppliers.category — the work trade a supplier entry is filed under
--       (free text like job_works.category). A unit can have multiple suppliers
--       per trade, and the same supplier can be used across trades/units.
--
--  Requires public.is_boss() and public.unit_suppliers (from supplier_progress.sql).
--  Run ONCE in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

-- 1. Reusable supplier names (boss-only)
create table if not exists public.suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;
drop policy if exists "boss all suppliers" on public.suppliers;
create policy "boss all suppliers" on public.suppliers
  for all using (public.is_boss()) with check (public.is_boss());

-- 2. Tag each unit supplier entry with a trade (free text, like job_works.category)
alter table public.unit_suppliers
  add column if not exists category text not null default '';

-- 3. Seed the master list from suppliers already entered on units
insert into public.suppliers (name)
  select distinct btrim(supplier) from public.unit_suppliers
  where coalesce(btrim(supplier), '') <> ''
  on conflict (name) do nothing;

-- 4. Realtime for the master list
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'suppliers') then
    alter publication supabase_realtime add table public.suppliers;
  end if;
end $$;
