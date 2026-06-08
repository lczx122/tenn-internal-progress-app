// Generates supabase/seed.sql from the Tenn_MindHome_EE_TFM_ALC status sheet.
// Model: one JOB per unit; one JOB_WORK row per category on that unit, each
// with its OWN stage. Re-runnable: clears previously-imported rows first.
import { writeFileSync } from 'node:fs'

const statusToStage = (s) => {
  const t = (s || '').trim().toLowerCase()
  if (t.startsWith('in progress')) return 'in_progress'
  if (t.startsWith('installing')) return 'installing'
  if (t.startsWith('collecting')) return 'collecting'
  if (t.startsWith('completed')) return 'completed'
  return 'booked'
}

// Mindhome (main reno): [unit, salesman, roomType, status, remarks]
const mindhome = [
  ['AG15', 'WAYNE', '2 Room Premium', 'Installing', '29/5 settling · CS2605/012'],
  ['AG16', 'WAYNE', '2 Room Premium', 'Installing', 'Left backend · CS2605/013'],
  ['A-03-02', 'TSL', '2 Room Customize', 'Completed', 'CS2604/203 8/5/2026'],
  ['A-08-10', 'WAYNE', '2 Room Customize', 'Completed', 'CS2604/134'],
  ['A-10-01', 'GES', '2 Room Customize', 'Completed', 'CS2604/202 8/5/26'],
  ['D-02-32', 'CHAI', '2 Room Standard', 'Collecting Money', '9 Jun payment · CS2605/061'],
  ['A-08-32', 'WAYNE', '2 Room Premium (exclude 旋转桌)', 'Completed', 'CS2605/123'],
  ['B-12-08', 'CHAI', '3 Room Premium add-on 厨房吊柜', 'Completed', 'CS2605/194'],
  ['A-09-15', 'BCY', 'Black Dry Kitchen Cabinet set', 'Completed', ''],
  ['B-03-07', 'WAYNE', '3 Room Premium (餐边柜 change 厨房吊柜)', 'Collecting Money', '29/5 settling'],
  ['C-03-09', 'BILLY', '3 Room Premium', 'Installing', '2 June install'],
  ['C-05-02', 'CZX', '3 Room Premium', 'Installing', 'Done by 29 June'],
  ['E-12-05', 'GES', '3 Room Premium (餐边柜+玄关柜 change 厨房对面柜)', 'In Progress', '开着料'],
  ['D-G-16', 'WAYNE', '2 Room Standard', 'In Progress', '开着料'],
  ['D-03-26', 'GES', '2 Room Premium (exclude 厨房柜)', 'In Progress', '开着料'],
  ['A-10-06', 'GES', '2 Room Standard', 'In Progress', ''],
  ['A-11-13', 'WAYNE', '2 Room Standard', 'In Progress', ''],
  ['B-03A-01', 'WAYNE', '3 Room Premium', 'In Progress', ''],
  ['B-03-05', 'WAYNE', '3 Room Premium', 'In Progress', ''],
  ['D-07-13', 'WAYNE', '2 Room Standard', 'In Progress', ''],
  ['D-12-11', 'CHAI', '2 Room Premium', 'In Progress', ''],
  ['B-12-02', 'GES', '3 Room Premium (Masterroom, 2nd bedroom, foyer & tv)', '', ''],
  ['B-11-07', 'CZX', '3 Room Premium', '', ''],
]

// Add-on categories: [unit, category, title, status, remarks]
const addon = [
  // Smart Home
  ['B-08-07', 'Smart Home', 'Smart Home', 'Completed', 'Full cash'],
  ['C-01-02', 'Smart Home', 'Smart Home', 'Installing', '99+(5940) 24-month installment'],
  ['B-12-08', 'Smart Home', 'Smart Home', 'Installing', '50% cash payment only'],
  ['C-05-02', 'Smart Home', 'Smart Home', 'Installing', ''],
  ['A-11-13', 'Smart Home', 'Smart Home', 'Completed', '99+(5940) 36-month installment'],
  ['C-03-09', 'Smart Home', 'Smart Home', 'Installing', 'Pay from Tenn Mindhome'],
  ['E-07-03A', 'Smart Home', 'Smart Home', 'In Progress', '99 (planning installment)'],
  ['C-08-09', 'Smart Home', 'Smart Home', '', '3/6 receive payment'],
  // Smart Lock
  ['A-08-33A', 'Smart Lock', 'Standard Smart Lock', 'Completed', ''],
  ['D-05-23A', 'Smart Lock', 'Premium Smart Lock', 'Completed', ''],
  ['D-07-23', 'Smart Lock', 'Premium Smart Lock', 'Completed', ''],
  ['C-05-02', 'Smart Lock', 'Premium Smart Lock', 'In Progress', 'Grey (stock) · after finish reno'],
  ['A-05-03', 'Smart Lock', 'Premium Smart Lock', 'In Progress', 'Black (order) · after finish reno'],
  ['A-10-06', 'Smart Lock', 'Premium Smart Lock', 'In Progress', 'Black (stock) · after finish reno'],
  ['A-07-06', 'Smart Lock', 'Standard Smart Lock', 'In Progress', 'Normal (stock) · after finish reno'],
  ['B-12-08', 'Smart Lock', 'Premium Smart Lock', 'In Progress', 'Black (order) · after finish reno'],
  ['B-08-07', 'Smart Lock', 'Premium Smart Lock', 'Collecting Money', 'Black (stock) · planning install'],
  ['A-11-13', 'Smart Lock', 'Premium Smart Lock', 'Completed', 'Black (stock)'],
  // Aluminium Cabinet
  ['A-10-01', 'Aluminium', 'Small Yard Aluminium Cabinet', 'Completed', ''],
  ['D-08-26', 'Aluminium', 'Dry Kitchen table top 6ft cabinet', 'Completed', ''],
  ['C-13-12', 'Aluminium', 'Dry Kitchen table top 7ft cabinet', 'Completed', ''],
  ['A-10-06', 'Aluminium', 'Plaster Ceiling', 'Completed', ''],
  ['A-07-06', 'Aluminium', 'Dry & Yard Kitchen Cabinet', 'Installing', 'KEY PASSED TO OWNER'],
  ['E-12-05', 'Aluminium', 'Shoes Cabinet', 'Completed', ''],
  ['A-12-08', 'Aluminium', 'Dry & Yard Kitchen Cabinet', 'In Progress', 'Waiting owner to pass gas stove'],
  ['B-12-02', 'Aluminium', 'Dry Kitchen Cabinet', '', ''],
  // EE / Electrical
  ['A-10-06', 'EE', 'Electrical', 'Completed', ''],
  ['C-13-12', 'EE', 'Electrical', 'Completed', ''],
  ['D-01-32', 'EE', 'Electrical', 'Completed', ''],
  ['C-01-02', 'EE', 'Electrical', 'Completed', ''],
  ['C-03-09', 'EE', 'Electrical', 'Completed', ''],
  ['C-05-02', 'EE', 'Electrical', 'Completed', ''],
  ['E-12-05', 'EE', 'Electrical', 'Completed', ''],
  ['D-03-26', 'EE', 'Electrical', 'Collecting Money', 'Collected 80%'],
  ['B-12-08', 'EE', 'Electrical', 'In Progress', 'Change plug location'],
  ['A-07-06', 'EE', 'Electrical', 'Completed', ''],
  // Products (fans / AC / hood etc.)
  ['A-03-02', 'Products', 'Products', 'Completed', ''],
  ['D-03-26', 'Products', 'Fans / AC', 'Collecting Money', 'AC install 28/5'],
  ['A-10-06', 'Products', 'Fans / AC / Livinox', 'In Progress', 'Install 28/5'],
  ['E-12-05', 'Products', 'Fans / AC / Livinox', 'Installing', 'Install 28/5'],
]

// Generic address for units that only appear in add-on tabs (no Mindhome row).
const addonOnlyAddress = {
  'B-08-07': 'Smart Home + Smart Lock',
  'C-01-02': 'Smart Home + Electrical',
  'E-07-03A': 'Smart Home',
  'C-08-09': 'Smart Home',
  'A-08-33A': 'Smart Lock',
  'D-05-23A': 'Smart Lock',
  'D-07-23': 'Smart Lock',
  'A-05-03': 'Smart Lock',
  'A-07-06': 'Aluminium + Smart Lock + Electrical',
  'D-08-26': 'Aluminium Cabinet',
  'C-13-12': 'Aluminium + Electrical',
  'A-12-08': 'Aluminium Cabinet',
  'D-01-32': 'Electrical',
}

const units = new Map()
const ensure = (code) => {
  if (!units.has(code))
    units.set(code, { code, salesman: '', address: '', keyHolder: 'Office', works: [] })
  return units.get(code)
}

for (const [code, salesman, room, status, remarks] of mindhome) {
  const u = ensure(code)
  u.salesman = salesman
  u.address = room
  u.works.push({ category: 'Mindhome', title: room, stage: statusToStage(status), remarks })
}
for (const [code, category, title, status, remarks] of addon) {
  const u = ensure(code)
  u.works.push({ category, title, stage: statusToStage(status), remarks })
  if (/KEY PASSED/i.test(remarks)) u.keyHolder = 'Owner (key passed)'
}
for (const u of units.values()) {
  if (!u.address) u.address = addonOnlyAddress[u.code] || ''
}

// ---- Emit SQL ----
const esc = (s) => String(s).replace(/'/g, "''")
const out = []
out.push('-- Seed: import from Tenn_MindHome_EE_TFM_ALC status sheet.')
out.push('-- Each unit = one job; each category = one job_works row with its own stage.')
out.push('-- Re-runnable: safe to run repeatedly (clears previous import first).')
out.push('-- Self-contained: also creates the job_works table if missing.\n')
out.push(`-- 1) Ensure the job_works table + security + realtime exist.
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
\n-- 2) Import the units and their categories.`)
out.push("alter table public.jobs alter column stage set default 'booked';")
out.push("delete from public.jobs where updated_by = 'Spreadsheet import';\n")

const sorted = [...units.values()].sort((a, b) => a.code.localeCompare(b.code))
let workCount = 0
for (const u of sorted) {
  out.push(
    `with j as (\n` +
      `  insert into public.jobs (customer_name, address, key_holder, updated_by)\n` +
      `  values ('${esc(u.code)}', '${esc(u.address)}', '${esc(u.keyHolder)}', 'Spreadsheet import')\n` +
      `  returning id\n` +
      `)\n` +
      `insert into public.job_works (job_id, category, title, stage, remarks, updated_by)\n` +
      `select j.id, v.category, v.title, v.stage, v.remarks, 'Spreadsheet import' from j, (values\n` +
      u.works
        .map(
          (w) => `  ('${esc(w.category)}', '${esc(w.title)}', '${w.stage}', '${esc(w.remarks)}')`
        )
        .join(',\n') +
      `\n) as v(category, title, stage, remarks);`
  )
  // Record salesman as a unit note (timeline) where known.
  if (u.salesman) {
    out.push(
      `insert into public.job_events (job_id, type, body, author_name)\n` +
        `select id, 'created', 'Imported · Salesman: ${esc(u.salesman)}', 'Import' from public.jobs\n` +
        `where customer_name = '${esc(u.code)}' and updated_by = 'Spreadsheet import';`
    )
  }
  out.push('')
  workCount += u.works.length
}

writeFileSync('supabase/seed.sql', out.join('\n'))
console.log(`Generated supabase/seed.sql: ${sorted.length} units, ${workCount} work rows.`)
