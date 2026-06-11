-- ============================================================================
--  Boss role + Costing (profit sharing & commissions)
-- ----------------------------------------------------------------------------
--  Boss is the TOP role: every admin power PLUS the Boss-only Costing area
--  (profit/commission figures), which is hidden from admins and staff and
--  locked here at the database. Run AFTER setup.sql. Run ONCE. Safe to re-run.
--
--  ▶▶ Make yourself a boss (replace the email):
--    update public.profiles set role = 'boss'
--    where id = (select id from auth.users where email = 'you@example.com');
-- ============================================================================

-- Admins OR bosses pass is_admin() — boss inherits all admin powers.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','boss')); $$;

-- Only bosses pass is_boss() — gates the Costing area.
create or replace function public.is_boss()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'boss'); $$;

-- set_role: allow 'boss'; only a boss may grant/alter the boss role; never strip
-- the last privileged (admin/boss) user.
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

-- Costing: one row per cash sale. costs/commissions/shares are JSON line lists.
create table if not exists public.costings (
  id            uuid primary key default gen_random_uuid(),
  cash_sale_no  text not null default '',
  customer      text not null default '',
  costing_date  date,
  revenue       numeric not null default 0,
  costs         jsonb not null default '[]'::jsonb,   -- [{label, amount}]
  commissions   jsonb not null default '[]'::jsonb,   -- [{name, percent}] % of net profit
  shares        jsonb not null default '[]'::jsonb,   -- [{name, percent}] % of profit after commission
  notes         text not null default '',
  status        text not null default 'draft',        -- draft | finalized
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists costings_cash_idx    on public.costings (cash_sale_no);
create index if not exists costings_created_idx on public.costings (created_at desc);

drop trigger if exists costings_touch on public.costings;
create trigger costings_touch before update on public.costings
  for each row execute function public.touch_updated_at();

alter table public.costings enable row level security;
drop policy if exists "boss all costings" on public.costings;
create policy "boss all costings" on public.costings
  for all using (public.is_boss()) with check (public.is_boss());

do $$
begin
  if not exists (select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'costings') then
    alter publication supabase_realtime add table public.costings;
  end if;
end $$;
