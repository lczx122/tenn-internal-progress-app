// Generates supabase/seed.sql from the Tenn_MindHome_EE_TFM_ALC status sheet.
// Each unique unit becomes one job; every work-stream (Mindhome, Smart Home,
// Smart Lock, Aluminium, EE, Products) is folded into that job's timeline.
// Re-runnable: the seed deletes previously-imported rows before inserting.
import { writeFileSync } from 'node:fs'

const STAGE_ORDER = ['booked', 'in_progress', 'installing', 'collecting', 'completed']
const statusToStage = (s) => {
  const t = (s || '').trim().toLowerCase()
  if (t.startsWith('in progress')) return 'in_progress'
  if (t.startsWith('installing')) return 'installing'
  if (t.startsWith('collecting')) return 'collecting'
  if (t.startsWith('completed')) return 'completed'
  return 'booked'
}
const minStage = (keys) =>
  keys.reduce((a, b) => (STAGE_ORDER.indexOf(b) < STAGE_ORDER.indexOf(a) ? b : a), 'completed')

// --- Mindhome tab (main renovation): [unit, salesman, roomType, status, remark]
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

// --- Add-on tabs: per unit, a note line. [unit, noteText, status]
const addons = [
  // Smart Home
  ['B-08-07', 'Smart Home — Full cash', 'Completed'],
  ['C-01-02', 'Smart Home — 99+(5940) 24-month installment', 'Installing'],
  ['B-12-08', 'Smart Home — 50% cash payment only', 'Installing'],
  ['C-05-02', 'Smart Home', 'Installing'],
  ['A-11-13', 'Smart Home — 99+(5940) 36-month installment', 'Completed'],
  ['C-03-09', 'Smart Home — Pay from Tenn Mindhome', 'Installing'],
  ['E-07-03A', 'Smart Home — 99 (planning installment)', 'In Progress'],
  ['C-08-09', 'Smart Home — 3/6 receive payment', ''],
  // Smart Lock
  ['A-08-33A', 'Smart Lock — Standard', 'Completed'],
  ['D-05-23A', 'Smart Lock — Premium', 'Completed'],
  ['D-07-23', 'Smart Lock — Premium', 'Completed'],
  ['C-05-02', 'Smart Lock — Premium, grey (stock), after finish reno', 'In Progress'],
  ['A-05-03', 'Smart Lock — Premium, Black (order), after finish reno', 'In Progress'],
  ['A-10-06', 'Smart Lock — Premium, Black (stock), after finish reno', 'In Progress'],
  ['A-07-06', 'Smart Lock — Standard, Normal (stock), after finish reno', 'In Progress'],
  ['B-12-08', 'Smart Lock — Premium, Black (order), after finish reno', 'In Progress'],
  ['B-08-07', 'Smart Lock — Premium, Black (stock), planning install', 'Collecting Money'],
  ['A-11-13', 'Smart Lock — Premium, Black (stock)', 'Completed'],
  // Aluminium Cabinet
  ['A-10-01', 'Aluminium — Small Yard Cabinet', 'Completed'],
  ['D-08-26', 'Aluminium — Dry Kitchen table top 6ft cabinet', 'Completed'],
  ['C-13-12', 'Aluminium — Dry Kitchen table top 7ft cabinet', 'Completed'],
  ['A-10-06', 'Aluminium — Plaster Ceiling', 'Completed'],
  ['A-07-06', 'Aluminium — Dry & Yard Kitchen Cabinet · KEY PASSED TO OWNER', 'Installing'],
  ['E-12-05', 'Aluminium — Shoes Cabinet', 'Completed'],
  ['A-12-08', 'Aluminium — Dry & Yard Kitchen Cabinet, waiting owner to pass gas stove', 'In Progress'],
  ['B-12-02', 'Aluminium — Dry Kitchen Cabinet', ''],
  // EE (electrical)
  ['A-10-06', 'EE / Electrical', 'Completed'],
  ['C-13-12', 'EE / Electrical', 'Completed'],
  ['D-01-32', 'EE / Electrical', 'Completed'],
  ['C-01-02', 'EE / Electrical', 'Completed'],
  ['C-03-09', 'EE / Electrical', 'Completed'],
  ['C-05-02', 'EE / Electrical', 'Completed'],
  ['E-12-05', 'EE / Electrical', 'Completed'],
  ['D-03-26', 'EE / Electrical — collected 80%', 'Collecting Money'],
  ['B-12-08', 'EE / Electrical — change plug location', 'In Progress'],
  ['A-07-06', 'EE / Electrical', 'Completed'],
  // Products (fans / AC / hood etc.)
  ['A-03-02', 'Products', 'Completed'],
  ['D-03-26', 'Products — AC install 28/5', 'Collecting Money'],
  ['A-10-06', 'Products — fans, AC, Livinox (install 28/5)', 'In Progress'],
  ['E-12-05', 'Products — fans, AC, Livinox (install 28/5)', 'Installing'],
]

// Units that only appear in add-on tabs (no Mindhome reno row) get a job too.
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

// ---- Build unit map ----
const units = new Map()
const ensure = (code) => {
  if (!units.has(code))
    units.set(code, { code, salesman: '', address: '', stages: [], notes: [], keyHolder: 'Office' })
  return units.get(code)
}

for (const [code, salesman, room, status, remark] of mindhome) {
  const u = ensure(code)
  u.salesman = salesman
  u.address = room
  u.mindhomeStage = statusToStage(status)
  if (remark) u.notes.push(`Mindhome — ${remark}`)
}

for (const [code, note, status] of addons) {
  const u = ensure(code)
  const st = statusToStage(status)
  u.stages.push(st)
  u.notes.push(`${note} — ${status || 'Booked'}`)
  if (/KEY PASSED/i.test(note)) u.keyHolder = 'Owner (key passed)'
}

// Resolve headline stage + address for each unit.
for (const u of units.values()) {
  if (u.mindhomeStage) {
    u.stage = u.mindhomeStage
  } else {
    u.stage = u.stages.length ? minStage(u.stages) : 'booked'
    u.address = addonOnlyAddress[u.code] || u.address || ''
  }
}

// ---- Emit SQL ----
const esc = (s) => String(s).replace(/'/g, "''")
const lines = []
lines.push('-- Seed: import from Tenn_MindHome_EE_TFM_ALC status sheet.')
lines.push('-- Re-runnable: clears previously imported rows first.')
lines.push("-- Run in Supabase SQL Editor after schema.sql.\n")
lines.push("alter table public.jobs alter column stage set default 'booked';\n")
lines.push("delete from public.jobs where updated_by = 'Spreadsheet import';\n")

const sorted = [...units.values()].sort((a, b) => a.code.localeCompare(b.code))
for (const u of sorted) {
  lines.push(
    `insert into public.jobs (customer_name, address, stage, key_holder, updated_by) values ` +
      `('${esc(u.code)}', '${esc(u.address)}', '${u.stage}', '${esc(u.keyHolder)}', 'Spreadsheet import');`
  )
  const events = []
  if (u.salesman) events.push(`Salesman: ${u.salesman}`)
  events.push(...u.notes)
  for (const body of events) {
    lines.push(
      `insert into public.job_events (job_id, type, body, author_name) ` +
        `select id, 'note', '${esc(body)}', 'Import' from public.jobs ` +
        `where customer_name = '${esc(u.code)}' and updated_by = 'Spreadsheet import';`
    )
  }
  lines.push('')
}

writeFileSync('supabase/seed.sql', lines.join('\n'))
console.log(`Generated supabase/seed.sql with ${sorted.length} units.`)
