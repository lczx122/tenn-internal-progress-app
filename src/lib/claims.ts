import type { Claim } from './types'
import { CLAIM_CATEGORIES } from './units'

export const money = (n: number) =>
  'RM ' + Number(n || 0).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
