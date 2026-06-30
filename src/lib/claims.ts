import type { Claim, Job } from './types'
import { CLAIM_CATEGORIES } from './units'

export const money = (n: number) =>
  'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Whole-ringgit (no decimals) — for tight summary tiles where the full figure
// won't fit (e.g. the dashboard Collection panel's narrow Order/Collected tiles).
export const money0 = (n: number) =>
  'RM ' + Math.round(Number(n || 0)).toLocaleString('en-MY')

// Total collected across a set of claims.
export function collectedTotal(claims: Claim[]): number {
  return claims.reduce((s, c) => s + Number(c.amount || 0), 0)
}

// Sum collected per standard category (returns one number per CLAIM_CATEGORIES).
export function sumByCategory(claims: Claim[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const cat of CLAIM_CATEGORIES) out[cat] = 0
  for (const c of claims) {
    const cat = (CLAIM_CATEGORIES as readonly string[]).includes(c.category) ? c.category : 'Custom'
    out[cat] += Number(c.amount || 0)
  }
  return out
}

// One per-trade row for the collection detail: how much was ordered, collected
// and is still outstanding for a single work category. Collected comes from
// claims tagged with that work_category; order from job.order_by_category.
// Untagged claims land in an "Unallocated" row so the rows reconcile to the
// unit total.
export const UNALLOCATED = 'Unallocated'

export interface TradeRow {
  cat: string
  order: number
  collected: number
  balance: number
}

export function perTradeRows(job: Job, claims: Claim[]): TradeRow[] {
  const orderBy = job.order_by_category ?? {}
  const collectedBy: Record<string, number> = {}
  for (const c of claims) {
    const key = (c.work_category && String(c.work_category).trim()) || UNALLOCATED
    collectedBy[key] = (collectedBy[key] ?? 0) + Number(c.amount || 0)
  }
  const cats = new Set<string>([...Object.keys(orderBy), ...Object.keys(collectedBy)])
  cats.delete(UNALLOCATED)
  const rows: TradeRow[] = [...cats].map((cat) => {
    const order = Number(orderBy[cat] || 0)
    const collected = collectedBy[cat] ?? 0
    return { cat, order, collected, balance: order - collected }
  })
  const unalloc = collectedBy[UNALLOCATED] ?? 0
  if (unalloc > 0) rows.push({ cat: UNALLOCATED, order: 0, collected: unalloc, balance: -unalloc })
  return rows
}
