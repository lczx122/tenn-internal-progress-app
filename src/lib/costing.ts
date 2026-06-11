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
