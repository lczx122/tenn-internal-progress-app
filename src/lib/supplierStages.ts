// Supplier fulfilment stages for the per-unit, boss-only supplier tracker.
// Separate from the renovation STAGES (src/lib/stages.ts) — these track a
// supplier order from "to order" through to "installed". Edit this list to
// rename/reorder; the pills, progress bars and dropdowns follow automatically.
// The `key` values are stored in the database, so avoid changing those once live.

export interface SupplierStage {
  key: string
  label: string
  percent: number // 0-100, what the progress bar shows at this stage
  color: string // tailwind bg-* for the filled bar / active pill
}

export const SUPPLIER_STAGES: SupplierStage[] = [
  { key: 'to_order', label: 'To Order', percent: 0, color: 'bg-slate-400' },
  { key: 'ordered', label: 'Ordered', percent: 25, color: 'bg-amber-500' },
  { key: 'in_production', label: 'In Production', percent: 50, color: 'bg-yellow-500' },
  { key: 'delivered', label: 'Delivered', percent: 75, color: 'bg-lime-500' },
  { key: 'installed', label: 'Installed', percent: 100, color: 'bg-emerald-600' },
]

const byKey = new Map(SUPPLIER_STAGES.map((s) => [s.key, s]))

export function getSupplierStage(key: string): SupplierStage {
  return byKey.get(key) ?? SUPPLIER_STAGES[0]
}

// Average progress across a set of supplier rows (0-100).
export function supplierPercent(stageKeys: string[]): number {
  if (stageKeys.length === 0) return 0
  const sum = stageKeys.reduce((a, k) => a + getSupplierStage(k).percent, 0)
  return Math.round(sum / stageKeys.length)
}
