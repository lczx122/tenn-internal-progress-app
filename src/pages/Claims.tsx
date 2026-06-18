import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Claim, Job } from '../lib/types'
import { Layout } from '../components/Layout'
import { CLAIM_CATEGORIES } from '../lib/units'
import { money, sumByCategory } from '../lib/claims'
import { useAutoRefresh } from '../lib/useAutoRefresh'

export default function Claims() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  async function load() {
    const [{ data: j }, { data: c }] = await Promise.all([
      supabase.from('jobs').select('*').eq('is_archived', false).order('project'),
      supabase.from('claims').select('*'),
    ])
    setJobs((j as Job[]) ?? [])
    setClaims((c as Claim[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('claims-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useAutoRefresh(load)

  // Group claims by unit.
  const claimsByJob = useMemo(() => {
    const m = new Map<string, Claim[]>()
    for (const c of claims) {
      const arr = m.get(c.job_id) ?? []
      arr.push(c)
      m.set(c.job_id, arr)
    }
    return m
  }, [claims])

  // One row per unit that has an order total or any collection.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs
      .map((j) => {
        const list = claimsByJob.get(j.id) ?? []
        const byCat = sumByCategory(list)
        const collected = CLAIM_CATEGORIES.reduce((s, c) => s + byCat[c], 0)
        const order = Number(j.order_total || 0)
        return { job: j, byCat, collected, order, balance: order - collected }
      })
      .filter((r) => r.order > 0 || r.collected > 0)
      .filter(
        (r) =>
          !q ||
          r.job.customer_name.toLowerCase().includes(q) ||
          r.job.unit_code.toLowerCase().includes(q) ||
          r.job.project.toLowerCase().includes(q),
      )
      .sort((a, b) =>
        a.job.project.localeCompare(b.job.project) ||
        a.job.customer_name.localeCompare(b.job.customer_name),
      )
  }, [jobs, claimsByJob, query])

  // Column / grand totals for the footer.
  const totals = useMemo(() => {
    const byCat: Record<string, number> = {}
    for (const c of CLAIM_CATEGORIES) byCat[c] = 0
    let order = 0
    let collected = 0
    for (const r of rows) {
      for (const c of CLAIM_CATEGORIES) byCat[c] += r.byCat[c]
      order += r.order
      collected += r.collected
    }
    return { byCat, order, collected, balance: order - collected }
  }, [rows])

  const num = 'px-3 py-2 text-right tabular-nums whitespace-nowrap'
  const head = 'px-3 py-2 text-right text-xs font-semibold text-slate-500 whitespace-nowrap'

  return (
    <Layout title="Claims" bottomNav wide onRefresh={load}>
      <div className="mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search unit, customer, project…"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
      </div>

      {/* Summary tiles */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Tile label="Total order value" value={money(totals.order)} />
        <Tile label="Collected" value={money(totals.collected)} accent="text-emerald-600" />
        <Tile label="Outstanding" value={money(totals.balance)} accent={totals.balance > 0 ? 'text-amber-600' : 'text-slate-900'} />
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          No claims yet. Open a unit and set its order total to start tracking collections.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Unit</th>
                <th className={head}>Order</th>
                {CLAIM_CATEGORIES.map((c) => (
                  <th key={c} className={head}>
                    {c}
                  </th>
                ))}
                <th className={head}>Collected</th>
                <th className={head}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.job.id}
                  onClick={() => navigate(`/job/${r.job.id}`)}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{r.job.customer_name || r.job.unit_code || '—'}</div>
                    <div className="text-xs text-slate-400">
                      {[r.job.unit_code, r.job.project].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td className={num + ' text-slate-700'}>{r.order ? money(r.order) : '—'}</td>
                  {CLAIM_CATEGORIES.map((c) => (
                    <td key={c} className={num + ' text-slate-600'}>
                      {r.byCat[c] ? money(r.byCat[c]) : '—'}
                    </td>
                  ))}
                  <td className={num + ' font-semibold text-emerald-700'}>{money(r.collected)}</td>
                  <td className={num + (r.balance > 0 ? ' font-semibold text-amber-700' : ' text-slate-400')}>
                    {money(r.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-3 py-2 text-left text-slate-700">Total ({rows.length})</td>
                <td className={num + ' text-slate-800'}>{money(totals.order)}</td>
                {CLAIM_CATEGORIES.map((c) => (
                  <td key={c} className={num + ' text-slate-800'}>
                    {money(totals.byCat[c])}
                  </td>
                ))}
                <td className={num + ' text-emerald-700'}>{money(totals.collected)}</td>
                <td className={num + ' text-amber-700'}>{money(totals.balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Layout>
  )
}

function Tile({ label, value, accent = 'text-slate-900' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className={`text-base font-bold leading-tight sm:text-xl ${accent}`}>{value}</div>
      <div className="mt-1 text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  )
}
