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
  { key: 'booked',      label: 'Booked',                percent: 0,   color: 'bg-slate-400' },
  { key: 'in_progress', label: 'In Progress (开料)',     percent: 30,  color: 'bg-amber-500' },
  { key: 'installing',  label: 'Installing (安装)',      percent: 60,  color: 'bg-yellow-500' },
  { key: 'collecting',  label: 'Collecting Money',      percent: 85,  color: 'bg-lime-500' },
  { key: 'completed',   label: 'Completed',             percent: 100, color: 'bg-emerald-600' },
]

const byKey = new Map(STAGES.map((s) => [s.key, s]))

export function getStage(key: string): Stage {
  return byKey.get(key) ?? STAGES[0]
}

// Average progress across a unit's work categories (0-100).
export function overallPercent(stageKeys: string[]): number {
  if (stageKeys.length === 0) return 0
  const sum = stageKeys.reduce((a, k) => a + getStage(k).percent, 0)
  return Math.round(sum / stageKeys.length)
}
