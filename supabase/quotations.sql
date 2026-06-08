-- ============================================================================
--  Quotations register
-- ----------------------------------------------------------------------------
--  A shared, team-wide list of saved quotations. Numbers use the format
--  QT-YYMM-XXX (e.g. QT-2606-001). The running sequence per month is assigned
--  by the database the moment a quote is SAVED, so numbers are sequential and
--  unique across everyone — no clashes when two staff quote at the same time.
--
--  Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run.
--  Safe to re-run.
-- ============================================================================

create table if not exists public.quotations (
  id             uuid primary key default gen_random_uuid(),
  number         text not null unique,          -- 'QT-2606-001'
  yymm           text not null,                 -- '2606'
  seq            int  not null,                 -- 1, 2, 3 … within the month
  customer_name  text not null default '',
  customer_phone text not null default '',
  unit           text not null default '',
  prepared_by    text not null default '',
  categories     text not null default '',      -- comma list, for the register row
  total          numeric not null default 0,    -- final balance
  payload        jsonb not null default '{}'::jsonb,  -- full quote (line items etc.)
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  unique (yymm, seq)
);

create index if not exists quotations_created_idx on public.quotations (created_at desc);

-- All signed-in staff can read the register and add to it; anon gets nothing.
alter table public.quotations enable row level security;

drop policy if exists "auth read quotations"   on public.quotations;
drop policy if exists "auth insert quotations" on public.quotations;
create policy "auth read quotations" on public.quotations
  for select using (auth.role() = 'authenticated');
create policy "auth insert quotations" on public.quotations
  for insert with check (auth.role() = 'authenticated');

-- Atomically reserve the next sequence for the current month and insert the
-- quotation. The advisory lock serialises concurrent saves so two people can
-- never be handed the same number.
create or replace function public.create_quotation(
  p_payload      jsonb,
  p_customer     text,
  p_phone        text,
  p_unit         text,
  p_prepared_by  text,
  p_categories   text,
  p_total        numeric
) returns public.quotations
language plpgsql
security definer set search_path = public
as $$
declare
  v_yymm text := to_char(now(), 'YYMM');
  v_seq  int;
  v_row  public.quotations;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Not authorised';
  end if;

  perform pg_advisory_xact_lock(hashtext('tenn_quote_' || v_yymm));

  select coalesce(max(seq), 0) + 1 into v_seq
    from public.quotations where yymm = v_yymm;

  insert into public.quotations
    (number, yymm, seq, customer_name, customer_phone, unit,
     prepared_by, categories, total, payload, created_by)
  values
    ('QT-' || v_yymm || '-' || lpad(v_seq::text, 3, '0'),
     v_yymm, v_seq,
     coalesce(p_customer, ''), coalesce(p_phone, ''), coalesce(p_unit, ''),
     coalesce(p_prepared_by, ''), coalesce(p_categories, ''),
     coalesce(p_total, 0), coalesce(p_payload, '{}'::jsonb), auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

-- Live updates so the register refreshes on everyone's screen.
do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quotations') then
    alter publication supabase_realtime add table public.quotations;
  end if;
end $$;
