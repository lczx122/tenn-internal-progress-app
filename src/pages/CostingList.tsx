import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Costing } from '../lib/types'
import { Layout } from '../components/Layout'
import { calcCosting, money } from '../lib/costing'
import { relativeTime } from '../lib/format'

export default function CostingList() {
  const { isBoss } = useAuth()
  const [rows, setRows] = useState<Costing[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  async function load() {
    const { data } = await supabase
      .from('costings')
      .select('*')
      .order('created_at', { ascending: false })
    setRows((data as Costing[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    if (!isBoss) {
      setLoading(false)
      return
    }
    load()
    const channel = supabase
      .channel('costings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costings' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [isBoss])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) => r.cash_sale_no.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q),
    )
  }, [rows, query])

  const totals = useMemo(() => {
    let rev = 0
    let profit = 0
    for (const r of visible) {
      rev += Number(r.revenue || 0)
      profit += calcCosting(r).netProfit
    }
    return { rev, profit }
  }, [visible])

  if (!isBoss) {
    return (
      <Layout title="Costing" bottomNav>
        <p className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Boss only.
        </p>
      </Layout>
    )
  }

  return (
    <Layout title="Costing" bottomNav>
      <div className="mb-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search cash sale no. or customer…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <button
          onClick={() => navigate('/costing/new')}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white active:bg-slate-700"
        >
          + New
        </button>
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          {rows.length === 0 ? 'No costings yet. Tap “+ New”.' : 'Nothing matches your search.'}
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="text-xs text-slate-400">Revenue ({visible.length})</div>
              <div className="text-lg font-bold text-slate-900">{money(totals.rev)}</div>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <div className="text-xs text-slate-400">Net profit</div>
              <div className={'text-lg font-bold ' + (totals.profit < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                {money(totals.profit)}
              </div>
            </div>
          </div>
          <ul className="space-y-3">
            {visible.map((r) => {
              const c = calcCosting(r)
              return (
                <li
                  key={r.id}
                  onClick={() => navigate(`/costing/${r.id}`)}
                  className="cursor-pointer rounded-xl bg-white p-4 shadow-sm active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900">
                          {r.cash_sale_no || '(no cash sale no.)'}
                        </span>
                        {r.status === 'finalized' && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            FINAL
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate font-medium text-slate-800">{r.customer || '—'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs text-slate-400">Net profit</div>
                      <div className={'font-semibold ' + (c.netProfit < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                        {money(c.netProfit)}
                      </div>
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400">
                    Revenue {money(Number(r.revenue))} · {relativeTime(r.created_at)}
                  </p>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Layout>
  )
}
