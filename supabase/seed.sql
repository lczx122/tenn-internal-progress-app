-- Seed: import from Tenn_MindHome_EE_TFM_ALC status sheet.
-- Each unit = one job; each category = one job_works row with its own stage.
-- Re-runnable: safe to run repeatedly (clears previous import first).
-- Self-contained: also creates the job_works table if missing.

-- 1) Ensure the job_works table + security + realtime exist.
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
alter table public.job_works enable row level security;
drop policy if exists "auth all works" on public.job_works;
create policy "auth all works" on public.job_works
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
drop trigger if exists job_works_touch on public.job_works;
create trigger job_works_touch before update on public.job_works
  for each row execute function public.touch_job();
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='job_works') then
    alter publication supabase_realtime add table public.job_works;
  end if;
end $$;

-- 2) Import the units and their categories.
alter table public.jobs alter column stage set default 'booked';
delete from public.jobs where updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('A-03-02', '2 Room Customize', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Customize', 'completed', 'CS2604/203 8/5/2026'),
  ('Products', 'Products', 'completed', '')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: TSL', 'Import' from public.jobs
where customer_name = 'A-03-02' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('A-05-03', 'Smart Lock', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Smart Lock', 'Premium Smart Lock', 'in_progress', 'Black (order) · after finish reno')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('A-07-06', 'Aluminium + Smart Lock + Electrical', 'Owner (key passed)', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Smart Lock', 'Standard Smart Lock', 'in_progress', 'Normal (stock) · after finish reno'),
  ('Aluminium', 'Dry & Yard Kitchen Cabinet', 'installing', 'KEY PASSED TO OWNER'),
  ('EE', 'Electrical', 'completed', '')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('A-08-10', '2 Room Customize', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Customize', 'completed', 'CS2604/134')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: WAYNE', 'Import' from public.jobs
where customer_name = 'A-08-10' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('A-08-32', '2 Room Premium (exclude 旋转桌)', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Premium (exclude 旋转桌)', 'completed', 'CS2605/123')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: WAYNE', 'Import' from public.jobs
where customer_name = 'A-08-32' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('A-08-33A', 'Smart Lock', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Smart Lock', 'Standard Smart Lock', 'completed', '')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('A-09-15', 'Black Dry Kitchen Cabinet set', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', 'Black Dry Kitchen Cabinet set', 'completed', '')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: BCY', 'Import' from public.jobs
where customer_name = 'A-09-15' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('A-10-01', '2 Room Customize', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Customize', 'completed', 'CS2604/202 8/5/26'),
  ('Aluminium', 'Small Yard Aluminium Cabinet', 'completed', '')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: GES', 'Import' from public.jobs
where customer_name = 'A-10-01' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('A-10-06', '2 Room Standard', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Standard', 'in_progress', ''),
  ('Smart Lock', 'Premium Smart Lock', 'in_progress', 'Black (stock) · after finish reno'),
  ('Aluminium', 'Plaster Ceiling', 'completed', ''),
  ('EE', 'Electrical', 'completed', ''),
  ('Products', 'Fans / AC / Livinox', 'in_progress', 'Install 28/5')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: GES', 'Import' from public.jobs
where customer_name = 'A-10-06' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('A-11-13', '2 Room Standard', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Standard', 'in_progress', ''),
  ('Smart Home', 'Smart Home', 'completed', '99+(5940) 36-month installment'),
  ('Smart Lock', 'Premium Smart Lock', 'completed', 'Black (stock)')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: WAYNE', 'Import' from public.jobs
where customer_name = 'A-11-13' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('A-12-08', 'Aluminium Cabinet', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Aluminium', 'Dry & Yard Kitchen Cabinet', 'in_progress', 'Waiting owner to pass gas stove')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('AG15', '2 Room Premium', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Premium', 'installing', '29/5 settling · CS2605/012')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: WAYNE', 'Import' from public.jobs
where customer_name = 'AG15' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('AG16', '2 Room Premium', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Premium', 'installing', 'Left backend · CS2605/013')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: WAYNE', 'Import' from public.jobs
where customer_name = 'AG16' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('B-03-05', '3 Room Premium', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '3 Room Premium', 'in_progress', '')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: WAYNE', 'Import' from public.jobs
where customer_name = 'B-03-05' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('B-03-07', '3 Room Premium (餐边柜 change 厨房吊柜)', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '3 Room Premium (餐边柜 change 厨房吊柜)', 'collecting', '29/5 settling')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: WAYNE', 'Import' from public.jobs
where customer_name = 'B-03-07' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('B-03A-01', '3 Room Premium', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '3 Room Premium', 'in_progress', '')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: WAYNE', 'Import' from public.jobs
where customer_name = 'B-03A-01' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('B-08-07', 'Smart Home + Smart Lock', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Smart Home', 'Smart Home', 'completed', 'Full cash'),
  ('Smart Lock', 'Premium Smart Lock', 'collecting', 'Black (stock) · planning install')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('B-11-07', '3 Room Premium', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '3 Room Premium', 'booked', '')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: CZX', 'Import' from public.jobs
where customer_name = 'B-11-07' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('B-12-02', '3 Room Premium (Masterroom, 2nd bedroom, foyer & tv)', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '3 Room Premium (Masterroom, 2nd bedroom, foyer & tv)', 'booked', ''),
  ('Aluminium', 'Dry Kitchen Cabinet', 'booked', '')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: GES', 'Import' from public.jobs
where customer_name = 'B-12-02' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('B-12-08', '3 Room Premium add-on 厨房吊柜', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '3 Room Premium add-on 厨房吊柜', 'completed', 'CS2605/194'),
  ('Smart Home', 'Smart Home', 'installing', '50% cash payment only'),
  ('Smart Lock', 'Premium Smart Lock', 'in_progress', 'Black (order) · after finish reno'),
  ('EE', 'Electrical', 'in_progress', 'Change plug location')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: CHAI', 'Import' from public.jobs
where customer_name = 'B-12-08' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('C-01-02', 'Smart Home + Electrical', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Smart Home', 'Smart Home', 'installing', '99+(5940) 24-month installment'),
  ('EE', 'Electrical', 'completed', '')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('C-03-09', '3 Room Premium', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '3 Room Premium', 'installing', '2 June install'),
  ('Smart Home', 'Smart Home', 'installing', 'Pay from Tenn Mindhome'),
  ('EE', 'Electrical', 'completed', '')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: BILLY', 'Import' from public.jobs
where customer_name = 'C-03-09' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('C-05-02', '3 Room Premium', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '3 Room Premium', 'installing', 'Done by 29 June'),
  ('Smart Home', 'Smart Home', 'installing', ''),
  ('Smart Lock', 'Premium Smart Lock', 'in_progress', 'Grey (stock) · after finish reno'),
  ('EE', 'Electrical', 'completed', '')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: CZX', 'Import' from public.jobs
where customer_name = 'C-05-02' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('C-08-09', 'Smart Home', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Smart Home', 'Smart Home', 'booked', '3/6 receive payment')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('C-13-12', 'Aluminium + Electrical', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Aluminium', 'Dry Kitchen table top 7ft cabinet', 'completed', ''),
  ('EE', 'Electrical', 'completed', '')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('D-01-32', 'Electrical', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('EE', 'Electrical', 'completed', '')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('D-02-32', '2 Room Standard', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Standard', 'collecting', '9 Jun payment · CS2605/061')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: CHAI', 'Import' from public.jobs
where customer_name = 'D-02-32' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('D-03-26', '2 Room Premium (exclude 厨房柜)', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Premium (exclude 厨房柜)', 'in_progress', '开着料'),
  ('EE', 'Electrical', 'collecting', 'Collected 80%'),
  ('Products', 'Fans / AC', 'collecting', 'AC install 28/5')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: GES', 'Import' from public.jobs
where customer_name = 'D-03-26' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('D-05-23A', 'Smart Lock', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Smart Lock', 'Premium Smart Lock', 'completed', '')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('D-07-13', '2 Room Standard', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Standard', 'in_progress', '')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: WAYNE', 'Import' from public.jobs
where customer_name = 'D-07-13' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('D-07-23', 'Smart Lock', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Smart Lock', 'Premium Smart Lock', 'completed', '')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('D-08-26', 'Aluminium Cabinet', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Aluminium', 'Dry Kitchen table top 6ft cabinet', 'completed', '')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('D-12-11', '2 Room Premium', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Premium', 'in_progress', '')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: CHAI', 'Import' from public.jobs
where customer_name = 'D-12-11' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('D-G-16', '2 Room Standard', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '2 Room Standard', 'in_progress', '开着料')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: WAYNE', 'Import' from public.jobs
where customer_name = 'D-G-16' and updated_by = 'Spreadsheet import';

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('E-07-03A', 'Smart Home', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Smart Home', 'Smart Home', 'in_progress', '99 (planning installment)')
) as v(category, title, stage, remarks);

with j as (
  insert into public.jobs (customer_name, address, key_holder, updated_by)
  values ('E-12-05', '3 Room Premium (餐边柜+玄关柜 change 厨房对面柜)', 'Office', 'Spreadsheet import')
  returning id
)
insert into public.job_works (job_id, category, title, stage, remarks, updated_by)
select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values
  ('Mindhome', '3 Room Premium (餐边柜+玄关柜 change 厨房对面柜)', 'in_progress', '开着料'),
  ('Aluminium', 'Shoes Cabinet', 'completed', ''),
  ('EE', 'Electrical', 'completed', ''),
  ('Products', 'Fans / AC / Livinox', 'installing', 'Install 28/5')
) as v(category, title, stage, remarks);
insert into public.job_events (job_id, type, body, author_name)
select id, 'created', 'Imported · Salesman: GES', 'Import' from public.jobs
where customer_name = 'E-12-05' and updated_by = 'Spreadsheet import';
