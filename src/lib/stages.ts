// The fixed renovation workflow. Each job sits at exactly one stage; the
// progress bar is derived from the stage's position in this list.
//
// Want different stages or names? Just edit this list — the whole app,
// progress bars and dropdowns included, updates automatically. The `key`
// values are what get stored in the database, so avoid changing those once
// you have live jobs (add/reorder is fine, renaming a key orphans old data).

export interface Stage {
  key: string
  label: string
  // 0-100, what the progress bar shows when a job is at this stage.
  percent: number
  color: string
}

export const STAGES: Stage[] = [
  { key: 'not_started', label: 'Not started',          percent: 0,   color: 'bg-slate-400' },
  { key: 'demolition',  label: 'Demolition',           percent: 15,  color: 'bg-orange-500' },
  { key: 'mep',         label: 'Plumbing & Electrical', percent: 35, color: 'bg-amber-500' },
  { key: 'tiling',      label: 'Tiling & Waterproofing', percent: 55, color: 'bg-yellow-500' },
  { key: 'carpentry',   label: 'Carpentry & Fixtures', percent: 70,  color: 'bg-lime-500' },
  { key: 'painting',    label: 'Painting',             percent: 85,  color: 'bg-green-500' },
  { key: 'handover',    label: 'Cleaning & Handover',  percent: 100, color: 'bg-emerald-600' },
]

const byKey = new Map(STAGES.map((s) => [s.key, s]))

export function getStage(key: string): Stage {
  return byKey.get(key) ?? STAGES[0]
}
