export const num = (v: unknown): number => {
  const n = parseFloat(String(v))
  return isNaN(n) ? 0 : n
}

export const money = (n: number): string =>
  'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Business categories, mirroring the workbook's analysis sheets.
export const COSTING_CATEGORIES = [
  { key: 'reno', label: 'Mindhome / Reno' },
  { key: 'smarthome', label: 'Smart Home' },
  { key: 'smartlock', label: 'Smart Lock' },
  { key: 'alucab', label: 'Aluminium Cabinet' },
  { key: 'ee', label: 'EE' },
  { key: 'product', label: 'Products' },
] as const

export function categoryLabel(key: string): string {
  return COSTING_CATEGORIES.find((c) => c.key === key)?.label ?? (key || 'Uncategorised')
}

export const COSTING_STATUSES = [
  'Chatting',
  'In Progress',
  'Installing',
  'Collecting Money',
  'Completed',
]

// The cost columns each category uses in the workbook (exact headers). Picking
// a category pre-fills these as cost lines so the form/sheet match that sheet.
export const CATEGORY_TEMPLATES: Record<string, string[]> = {
  reno: [
    'Material Costing',
    'Bank Installment Charges',
    'Bank Charges',
    'Comm Bal',
    'Salesman Comm (w/c/l/g)',
    'Salesman Comm (angel/sally)',
    'Salesman Comm (CZX/GES)',
  ],
  smarthome: ['Bank Interest', 'Material Costing', 'Salesman Comm', 'Overriding Comm'],
  smartlock: ['Bank Comm', 'Device Costing', 'Installation', 'Lalamove', 'Salesman Comm (3%)'],
  alucab: ['Cabinet Costing', 'Sink & Paip'],
  ee: ['Costing'],
  product: ['Costing'],
}

export function templateFor(category: string): string[] {
  return CATEGORY_TEMPLATES[category] ?? ['Costing']
}

// ---- colour coding ----
export const CATEGORY_ACCENT: Record<string, string> = {
  reno: 'bg-indigo-500',
  smarthome: 'bg-teal-500',
  smartlock: 'bg-violet-500',
  alucab: 'bg-sky-500',
  ee: 'bg-rose-500',
  product: 'bg-orange-500',
}

// Literal classes so Tailwind generates them (no runtime string building).
export const CATEGORY_BORDER: Record<string, string> = {
  reno: 'border-indigo-500',
  smarthome: 'border-teal-500',
  smartlock: 'border-violet-500',
  alucab: 'border-sky-500',
  ee: 'border-rose-500',
  product: 'border-orange-500',
}

export function statusStyle(s: string): string {
  switch (s) {
    case 'Completed':
      return 'bg-emerald-100 text-emerald-700'
    case 'Collecting Money':
      return 'bg-violet-100 text-violet-700'
    case 'Installing':
      return 'bg-sky-100 text-sky-700'
    case 'In Progress':
      return 'bg-amber-100 text-amber-700'
    case 'Chatting':
      return 'bg-slate-200 text-slate-600'
    default:
      return 'bg-slate-100 text-slate-600'
  }
}

// Map a unit's overall progress (0–100, averaged across its work-card stages)
// onto a costing status. Thresholds sit at the midpoints between the unit
// stages (booked 0, in-progress 30, installing 60, collecting 85, completed
// 100), so a linked costing tracks the actual on-site progress.
export function progressToStatus(percent: number): string {
  if (percent >= 100) return 'Completed'
  if (percent >= 73) return 'Collecting Money'
  if (percent >= 45) return 'Installing'
  if (percent >= 15) return 'In Progress'
  return 'Chatting'
}

// Margin colour: <20% poor, 20–40% ok, >40% good.
export function marginColor(m: number): string {
  if (m < 20) return 'text-rose-600'
  if (m < 40) return 'text-amber-600'
  return 'text-emerald-600'
}

export interface CostingCalc {
  directCost: number
  commissionAmounts: number[]
  totalCommission: number
  totalCost: number
  grossProfit: number
  margin: number
  shareAmounts: number[]
  totalShared: number
  unallocated: number
}

// The workbook model:
//  Commission        = fixed RM, or % of selling price — counted as a COST
//  Total Costing     = direct costs + commissions
//  Gross Profit      = selling price − total costing
//  Margin %          = gross profit / selling price
//  Profit share      = % of gross profit
export function calcCosting(c: {
  revenue: number | string
  costs: { amount: number | string }[]
  commissions: { kind?: string; value: number | string; percent?: number | string }[]
  shares: { percent: number | string }[]
}): CostingCalc {
  const revenue = num(c.revenue)
  const directCost = (c.costs ?? []).reduce((s, x) => s + num(x.amount), 0)
  const commissionAmounts = (c.commissions ?? []).map((cm) =>
    (cm.kind ?? 'fixed') === 'pct' ? (revenue * num(cm.value)) / 100 : num(cm.value),
  )
  const totalCommission = commissionAmounts.reduce((s, x) => s + x, 0)
  const totalCost = directCost + totalCommission
  const grossProfit = revenue - totalCost
  const margin = revenue ? (grossProfit / revenue) * 100 : 0
  const shareAmounts = (c.shares ?? []).map((s) => (grossProfit * num(s.percent)) / 100)
  const totalShared = shareAmounts.reduce((s, x) => s + x, 0)
  const unallocated = grossProfit - totalShared
  return {
    directCost,
    commissionAmounts,
    totalCommission,
    totalCost,
    grossProfit,
    margin,
    shareAmounts,
    totalShared,
    unallocated,
  }
}
