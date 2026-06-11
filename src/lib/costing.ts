export const num = (v: unknown): number => {
  const n = parseFloat(String(v))
  return isNaN(n) ? 0 : n
}

export const money = (n: number): string =>
  'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface CostingCalc {
  totalCost: number
  netProfit: number
  commissionAmounts: number[]
  totalCommission: number
  profitAfterComm: number
  shareAmounts: number[]
  totalShared: number
  unallocated: number
}

// The agreed sequence:
//  Net profit          = revenue − costs
//  Commission (each)   = % × net profit
//  Profit after comm.  = net profit − total commission
//  Share (each)        = % × profit after commission
export function calcCosting(c: {
  revenue: number | string
  costs: { amount: number | string }[]
  commissions: { percent: number | string }[]
  shares: { percent: number | string }[]
}): CostingCalc {
  const totalCost = (c.costs ?? []).reduce((s, x) => s + num(x.amount), 0)
  const netProfit = num(c.revenue) - totalCost
  const commissionAmounts = (c.commissions ?? []).map((x) => netProfit * (num(x.percent) / 100))
  const totalCommission = commissionAmounts.reduce((s, x) => s + x, 0)
  const profitAfterComm = netProfit - totalCommission
  const shareAmounts = (c.shares ?? []).map((x) => profitAfterComm * (num(x.percent) / 100))
  const totalShared = shareAmounts.reduce((s, x) => s + x, 0)
  const unallocated = profitAfterComm - totalShared
  return {
    totalCost,
    netProfit,
    commissionAmounts,
    totalCommission,
    profitAfterComm,
    shareAmounts,
    totalShared,
    unallocated,
  }
}
