import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Costing } from '../lib/types'
import { Layout } from '../components/Layout'
import { calcCosting, categoryLabel, money, num, templateFor, COSTING_CATEGORIES } from '../lib/costing'

type View = 'list' | 'sheet'

export default function CostingList() {
  const { isBoss } = useAuth()
  const [rows, setRows] = useState<Costing[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'sheet' : 'list',
  )
  const navigate = useNavigate()

  async function load() {
    const { data } = await supabase.from('costings').select('*').order('created_at', { ascending: false })
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
    return rows
      .filter((r) => !catFilter || r.category === catFilter)
      .filter(
        (r) => !q || r.cash_sale_no.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q),
      )
  }, [rows, query, catFilter])

  // Per-category summary + grand totals (mirrors the workbook's Summary sheet).
  const summary = useMemo(() => {
    const order = [...COSTING_CATEGORIES.map((c) => c.key), '']
    const map = new Map<string, { count: number; revenue: number; cost: number; gp: number }>()
    for (const r of visible) {
      const k = r.category || ''
      const cur = map.get(k) ?? { count: 0, revenue: 0, cost: 0, gp: 0 }
      const c = calcCosting(r)
      cur.count++
      cur.revenue += num(r.revenue)
      cur.cost += c.totalCost
      cur.gp += c.grossProfit
      map.set(k, cur)
    }
    const groups = order.filter((k) => map.has(k)).map((k) => ({ key: k, ...map.get(k)! }))
    const grand = groups.reduce(
      (a, g) => ({ count: a.count + g.count, revenue: a.revenue + g.revenue, cost: a.cost + g.cost, gp: a.gp + g.gp }),
      { count: 0, revenue: 0, cost: 0, gp: 0 },
    )
    return { groups, grand }
  }, [visible])

  if (!isBoss) {
    return (
      <Layout title="Costing" bottomNav>
        <p className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">Boss only.</p>
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
        <button onClick={() => navigate('/costing/new')} className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white active:bg-slate-700">
          + New
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className={`flex-1 rounded-lg border bg-white px-2 py-2 text-sm outline-none focus:border-slate-900 ${catFilter ? 'border-slate-900 font-medium' : 'border-slate-300 text-slate-600'}`}
        >
          <option value="">All categories</option>
          {COSTING_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
          {(['list', 'sheet'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={'rounded-md px-3 py-1.5 text-sm font-medium ' + (view === v ? 'bg-slate-900 text-white' : 'text-slate-600')}
            >
              {v === 'list' ? 'List' : 'Spreadsheet'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          {rows.length === 0 ? 'No costings yet. Tap “+ New”.' : 'Nothing matches your filter.'}
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="mb-4 overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Units</th>
                  <th className="px-3 py-2 text-right">Sales</th>
                  <th className="px-3 py-2 text-right">Gross profit</th>
                </tr>
              </thead>
              <tbody>
                {summary.groups.map((g) => (
                  <tr key={g.key} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-medium text-slate-700">{categoryLabel(g.key)}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{g.count}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{money(g.revenue)}</td>
                    <td className={'px-3 py-2 text-right font-medium ' + (g.gp < 0 ? 'text-rose-600' : 'text-emerald-600')}>{money(g.gp)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-900 font-semibold text-white">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{summary.grand.count}</td>
                  <td className="px-3 py-2 text-right">{money(summary.grand.revenue)}</td>
                  <td className="px-3 py-2 text-right">{money(summary.grand.gp)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {view === 'sheet' ? <Sheet rows={visible} onOpen={(id) => navigate(`/costing/${id}`)} /> : <Cards rows={visible} onOpen={(id) => navigate(`/costing/${id}`)} />}
        </>
      )}
    </Layout>
  )
}

// ---------- mobile card list ----------
function Cards({ rows, onOpen }: { rows: Costing[]; onOpen: (id: string) => void }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const c = calcCosting(r)
        return (
          <li key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer rounded-xl bg-white p-4 shadow-sm active:bg-slate-50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-900">{r.cash_sale_no || '(no CS no.)'}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{categoryLabel(r.category)}</span>
                </div>
                <p className="mt-0.5 truncate font-medium text-slate-800">{r.customer || '—'}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className={'font-semibold ' + (c.grossProfit < 0 ? 'text-rose-600' : 'text-emerald-600')}>{money(c.grossProfit)}</div>
                <div className="text-xs text-slate-400">{c.margin.toFixed(1)}% margin</div>
              </div>
            </div>
            <p className="mt-1.5 text-xs text-slate-400">
              Sale {money(num(r.revenue))} · cost {money(c.totalCost)}
              {r.status ? ` · ${r.status}` : ''}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

// ---------- desktop spreadsheet: one table per category, its own columns ----------
function costVal(r: Costing, label: string): number {
  return num((r.costs ?? []).find((c) => c.label === label)?.amount ?? 0)
}

function Sheet({ rows, onOpen }: { rows: Costing[]; onOpen: (id: string) => void }) {
  const order = [...COSTING_CATEGORIES.map((c) => c.key), '']
  const byCat = new Map()
  for (const r of rows) {
    const k = r.category || ''
    if (!byCat.has(k)) byCat.set(k, [])
    byCat.get(k).push(r)
  }
  const groups = order.filter((k) => byCat.has(k)).map((k) => ({ key: k, rows: byCat.get(k) }))
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <CategorySheet key={g.key} catKey={g.key} rows={g.rows} onOpen={onOpen} />
      ))}
    </div>
  )
}

function CategorySheet({ catKey, rows, onOpen }: { catKey: string; rows: Costing[]; onOpen: (id: string) => void }) {
  const cols = templateFor(catKey)
  const th = 'px-3 py-2 text-right'
  // subtotals
  const colSums = cols.map((col) => rows.reduce((s, r) => s + costVal(r, col), 0))
  const sub = rows.reduce(
    (a, r) => {
      const c = calcCosting(r)
      return { rev: a.rev + num(r.revenue), cost: a.cost + c.totalCost, gp: a.gp + c.grossProfit, sh: a.sh + c.totalShared }
    },
    { rev: 0, cost: 0, gp: 0, sh: 0 },
  )
  const minW = (cols.length + 8) * 96
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
        {categoryLabel(catKey)}
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{rows.length}</span>
      </h3>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-xs" style={{ minWidth: minW }}>
          <thead>
            <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Cash sale</th>
              <th className="px-3 py-2">Unit / item</th>
              {cols.map((col) => (
                <th key={col} className={th}>{col}</th>
              ))}
              <th className={th}>Selling</th>
              <th className={th}>Total cost</th>
              <th className={th}>Gross profit</th>
              <th className={th}>Margin</th>
              <th className={th}>Sharing</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = calcCosting(r)
              return (
                <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-700">{r.cash_sale_no || '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{r.customer || '—'}</td>
                  {cols.map((col) => (
                    <td key={col} className="px-3 py-2 text-right text-slate-500">{money(costVal(r, col))}</td>
                  ))}
                  <td className="px-3 py-2 text-right text-slate-700">{money(num(r.revenue))}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{money(c.totalCost)}</td>
                  <td className={'px-3 py-2 text-right font-medium ' + (c.grossProfit < 0 ? 'text-rose-600' : 'text-emerald-700')}>{money(c.grossProfit)}</td>
                  <td className="px-3 py-2 text-right text-slate-500">{c.margin.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right text-slate-500">{money(c.totalShared)}</td>
                  <td className="px-3 py-2 text-slate-500">{r.status}</td>
                </tr>
              )
            })}
            <tr className="text-xs font-semibold text-slate-600">
              <td className="px-3 py-1.5" colSpan={2}>Subtotal</td>
              {colSums.map((s, i) => (
                <td key={i} className="px-3 py-1.5 text-right">{money(s)}</td>
              ))}
              <td className="px-3 py-1.5 text-right">{money(sub.rev)}</td>
              <td className="px-3 py-1.5 text-right">{money(sub.cost)}</td>
              <td className="px-3 py-1.5 text-right text-emerald-700">{money(sub.gp)}</td>
              <td className="px-3 py-1.5"></td>
              <td className="px-3 py-1.5 text-right">{money(sub.sh)}</td>
              <td className="px-3 py-1.5"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
