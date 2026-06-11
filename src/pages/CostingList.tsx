import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Costing, JobWork } from '../lib/types'
import { Layout } from '../components/Layout'
import { overallPercent } from '../lib/stages'
import {
  calcCosting,
  categoryLabel,
  money,
  num,
  templateFor,
  progressToStatus,
  statusStyle,
  marginColor,
  CATEGORY_ACCENT,
  CATEGORY_BORDER,
  COSTING_CATEGORIES,
  COSTING_STATUSES,
} from '../lib/costing'

// Live progress derived from a linked unit's work cards.
export interface UnitProgress {
  percent: number
  status: string
}

type View = 'list' | 'sheet'

// Plain number (no "RM") for dense spreadsheet cells.
const nf = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function costVal(r: Costing, label: string): number {
  return num((r.costs ?? []).find((c) => c.label === label)?.amount ?? 0)
}

export default function CostingList() {
  const { isBoss } = useAuth()
  const [rows, setRows] = useState<Costing[]>([])
  const [jobProg, setJobProg] = useState<Map<string, UnitProgress>>(new Map())
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'sheet' : 'list',
  )
  const [sheetCat, setSheetCat] = useState<string>('')
  const navigate = useNavigate()

  const rowsRef = useRef<Costing[]>([])
  rowsRef.current = rows
  const editingRef = useRef(false)

  async function load() {
    const { data } = await supabase.from('costings').select('*').order('created_at', { ascending: false })
    setRows((data as Costing[]) ?? [])
    setLoading(false)
  }

  // Build the live progress map from units (work cards) so linked costings
  // reflect on-site progress instead of a hand-set status.
  async function loadProgress() {
    const { data } = await supabase.from('job_works').select('job_id,stage')
    const stagesByJob = new Map<string, string[]>()
    for (const x of (data as Pick<JobWork, 'job_id' | 'stage'>[]) ?? []) {
      const arr = stagesByJob.get(x.job_id) ?? []
      arr.push(x.stage)
      stagesByJob.set(x.job_id, arr)
    }
    const m = new Map<string, UnitProgress>()
    for (const [id, st] of stagesByJob) {
      const percent = overallPercent(st)
      m.set(id, { percent, status: progressToStatus(percent) })
    }
    setJobProg(m)
  }

  useEffect(() => {
    if (!isBoss) {
      setLoading(false)
      return
    }
    load()
    loadProgress()
    const channel = supabase
      .channel('costings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costings' }, () => {
        if (!editingRef.current) load() // don't clobber an in-progress edit
      })
      // Linked costings track unit progress — refresh when work cards move.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_works' }, () => loadProgress())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => loadProgress())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [isBoss])

  // Effective progress/status: a linked unit's live value wins over the stored
  // status; unlinked costings keep their manual status.
  function unitProgress(r: Costing): UnitProgress | null {
    return r.job_id ? jobProg.get(r.job_id) ?? null : null
  }
  function effectiveStatus(r: Costing): string {
    return unitProgress(r)?.status ?? r.status
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => !catFilter || r.category === catFilter)
      .filter((r) => !q || r.cash_sale_no.toLowerCase().includes(q) || r.customer.toLowerCase().includes(q))
  }, [rows, query, catFilter])

  // category groups present in the data (for tabs + summary)
  const groups = useMemo(() => {
    const order = [...COSTING_CATEGORIES.map((c) => c.key), '']
    const present = new Set(visible.map((r) => r.category || ''))
    return order.filter((k) => present.has(k))
  }, [visible])

  // keep the selected sheet tab valid
  useEffect(() => {
    if (groups.length && !groups.includes(sheetCat)) setSheetCat(groups[0])
  }, [groups, sheetCat])

  const summary = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number; gp: number }>()
    for (const r of visible) {
      const k = r.category || ''
      const cur = map.get(k) ?? { count: 0, revenue: 0, gp: 0 }
      cur.count++
      cur.revenue += num(r.revenue)
      cur.gp += calcCosting(r).grossProfit
      map.set(k, cur)
    }
    const list = groups.map((k) => ({ key: k, ...map.get(k)! }))
    const grand = list.reduce((a, g) => ({ count: a.count + g.count, revenue: a.revenue + g.revenue, gp: a.gp + g.gp }), { count: 0, revenue: 0, gp: 0 })
    return { list, grand }
  }, [visible, groups])

  // ---- inline editing ----
  function patchRow(id: string, patch: Record<string, unknown>) {
    setRows((prev) => prev.map((r) => (r.id === id ? ({ ...r, ...patch } as Costing) : r)))
  }
  function setCostCol(id: string, label: string, value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const costs = [...(r.costs ?? [])]
        const i = costs.findIndex((c) => c.label === label)
        const amt = num(value)
        if (i >= 0) costs[i] = { ...costs[i], amount: amt }
        else costs.push({ label, amount: amt })
        return { ...r, costs }
      }),
    )
  }
  async function saveRow(id: string) {
    const r = rowsRef.current.find((x) => x.id === id)
    if (!r) return
    await supabase
      .from('costings')
      .update({
        cash_sale_no: r.cash_sale_no,
        customer: r.customer,
        category: r.category,
        revenue: num(r.revenue),
        costs: r.costs,
        commissions: r.commissions,
        shares: r.shares,
        status: r.status,
        costing_date: r.costing_date,
      })
      .eq('id', r.id)
  }

  const sheetRows = visible.filter((r) => (r.category || '') === sheetCat)

  function exportCsv() {
    const cols = templateFor(sheetCat)
    const header = ['Unit / item', ...cols, 'Total cost', 'Selling', 'Gross profit', 'Margin %', 'Sharing', 'Status', 'Cash sale']
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }
    const lines = [header.map(esc).join(',')]
    for (const r of sheetRows) {
      const c = calcCosting(r)
      const cells = [
        r.customer,
        ...cols.map((col) => costVal(r, col).toFixed(2)),
        c.totalCost.toFixed(2),
        num(r.revenue).toFixed(2),
        c.grossProfit.toFixed(2),
        c.margin.toFixed(2),
        c.totalShared.toFixed(2),
        effectiveStatus(r),
        r.cash_sale_no,
      ]
      lines.push(cells.map(esc).join(','))
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `costing-${sheetCat || 'all'}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isBoss) {
    return (
      <Layout title="Costing" bottomNav>
        <p className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">Boss only.</p>
      </Layout>
    )
  }

  return (
    <Layout title="Costing" bottomNav wide>
      <div className="space-y-3 lg:max-w-3xl">
        <div className="flex gap-2">
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
        <div className="flex gap-2">
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
              <button key={v} onClick={() => setView(v)} className={'rounded-md px-3 py-1.5 text-sm font-medium ' + (view === v ? 'bg-slate-900 text-white' : 'text-slate-600')}>
                {v === 'list' ? 'List' : 'Spreadsheet'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          {rows.length === 0 ? 'No costings yet. Tap “+ New”.' : 'Nothing matches your filter.'}
        </div>
      ) : (
        <div className="mt-4">
          {/* Summary */}
          <div className="mb-4 overflow-hidden rounded-xl bg-white shadow-sm lg:max-w-3xl">
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
                {summary.list.map((g) => (
                  <tr key={g.key} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2 font-medium text-slate-700">
                        <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_ACCENT[g.key] ?? 'bg-slate-400'}`} />
                        {categoryLabel(g.key)}
                      </span>
                    </td>
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

          {view === 'sheet' ? (
            <>
              {/* category tabs */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {groups.map((k) => {
                  const active = k === sheetCat
                  return (
                    <button
                      key={k}
                      onClick={() => setSheetCat(k)}
                      className={
                        'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium ' +
                        (active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600')
                      }
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${CATEGORY_ACCENT[k] ?? 'bg-slate-400'}`} />
                      {categoryLabel(k)}
                      <span className={'rounded-full px-1.5 text-[11px] ' + (active ? 'bg-white/20' : 'bg-slate-200 text-slate-600')}>
                        {visible.filter((r) => (r.category || '') === k).length}
                      </span>
                    </button>
                  )
                })}
                <button
                  onClick={exportCsv}
                  className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 active:bg-slate-50"
                >
                  ⬇ Export CSV
                </button>
              </div>
              <EditableSheet
                catKey={sheetCat}
                rows={sheetRows}
                progressOf={unitProgress}
                onPatch={patchRow}
                onSetCost={setCostCol}
                onSave={saveRow}
                onFocus={() => (editingRef.current = true)}
                onBlurSave={(id) => {
                  editingRef.current = false
                  saveRow(id)
                }}
                onOpen={(id) => navigate(`/costing/${id}`)}
                onOpenUnit={(jobId) => navigate(`/job/${jobId}`)}
              />
            </>
          ) : (
            <div className="lg:max-w-3xl">
              <Cards rows={visible} progressOf={unitProgress} onOpen={(id) => navigate(`/costing/${id}`)} />
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}

// ---------- editable per-category spreadsheet ----------
function EditableSheet({
  catKey,
  rows,
  progressOf,
  onPatch,
  onSetCost,
  onSave,
  onFocus,
  onBlurSave,
  onOpen,
  onOpenUnit,
}: {
  catKey: string
  rows: Costing[]
  progressOf: (r: Costing) => UnitProgress | null
  onPatch: (id: string, patch: Record<string, unknown>) => void
  onSetCost: (id: string, label: string, value: string) => void
  onSave: (id: string) => void
  onFocus: () => void
  onBlurSave: (id: string) => void
  onOpen: (id: string) => void
  onOpenUnit: (jobId: string) => void
}) {
  const cols = templateFor(catKey)
  const colSums = cols.map((col) => rows.reduce((s, r) => s + costVal(r, col), 0))
  const sub = rows.reduce(
    (a, r) => {
      const c = calcCosting(r)
      return { rev: a.rev + num(r.revenue), cost: a.cost + c.totalCost, gp: a.gp + c.grossProfit, sh: a.sh + c.totalShared }
    },
    { rev: 0, cost: 0, gp: 0, sh: 0 },
  )
  // Column order matches the workbook: Unit → costs → Total → Selling → Gross
  // profit → Margin → Sharing → Status → Cash sale. Only the Unit column is
  // frozen (a single sticky column avoids the offset-overlap problem).
  const thBase = 'sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-2.5'
  const thNum = thBase + ' text-right'
  const editCls = 'w-full rounded bg-transparent px-1 py-0.5 text-right outline-none hover:bg-slate-100 focus:bg-amber-50'
  const unitTd = 'sticky left-0 z-[1] w-[210px] min-w-[210px] max-w-[210px] border-r border-slate-200 bg-white px-2 py-1'

  return (
    <div className={`max-h-[75vh] overflow-auto rounded-xl border-l-4 bg-white shadow-sm ${CATEGORY_BORDER[catKey] ?? 'border-slate-400'}`}>
      <table className="w-full whitespace-nowrap text-[13px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
            <th className={thBase + ' left-0 z-30 w-[210px] min-w-[210px] max-w-[210px] border-r'}>Unit / item</th>
            {cols.map((col) => (
              <th key={col} className={thNum}>{col}</th>
            ))}
            <th className={thNum}>Total cost</th>
            <th className={thNum}>Selling</th>
            <th className={thNum}>Gross profit</th>
            <th className={thNum}>Margin</th>
            <th className={thNum}>Sharing</th>
            <th className={thBase}>Status</th>
            <th className={thBase}>Cash sale</th>
            <th className={thBase}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => {
            const c = calcCosting(r)
            const prog = progressOf(r)
            const focus = { onFocus, onBlur: () => onBlurSave(r.id) }
            return (
              <tr key={r.id} className={'border-b border-slate-100 ' + (ri % 2 ? 'bg-slate-50' : 'bg-white')}>
                <td className={unitTd + (ri % 2 ? ' !bg-slate-50' : '')}>
                  <input className={editCls + ' text-left'} value={r.customer} {...focus} onChange={(e) => onPatch(r.id, { customer: e.target.value })} />
                </td>
                {cols.map((col) => {
                  const v = costVal(r, col)
                  return (
                    <td key={col} className="px-2 py-1">
                      <input type="number" step="0.01" className={editCls + ' text-slate-600'} value={v === 0 ? '' : v} {...focus} onChange={(e) => onSetCost(r.id, col, e.target.value)} />
                    </td>
                  )
                })}
                <td className="px-2 py-2.5 text-right text-slate-500">{nf(c.totalCost)}</td>
                <td className="px-2 py-1">
                  <input type="number" step="0.01" className={editCls + ' font-medium text-slate-800'} value={num(r.revenue) === 0 ? '' : (r.revenue as number) ?? ''} {...focus} onChange={(e) => onPatch(r.id, { revenue: e.target.value })} />
                </td>
                <td className={'px-2 py-2.5 text-right font-semibold ' + (c.grossProfit < 0 ? 'text-rose-600' : 'text-emerald-700')}>{nf(c.grossProfit)}</td>
                <td className={'px-2 py-2.5 text-right font-medium ' + marginColor(c.margin)}>{c.margin.toFixed(1)}%</td>
                <td className="px-2 py-2.5 text-right text-slate-500">{nf(c.totalShared)}</td>
                <td className="px-2 py-1">
                  {prog ? (
                    // Linked to a unit — status is derived from its work cards.
                    <button
                      type="button"
                      onClick={() => r.job_id && onOpenUnit(r.job_id)}
                      title="Synced from linked unit — open unit"
                      className="flex items-center gap-1.5"
                    >
                      <span className={'rounded-full px-2 py-0.5 text-[11px] font-medium ' + statusStyle(prog.status)}>{prog.status}</span>
                      <span className="text-[11px] text-slate-400">🔗 {prog.percent}%</span>
                    </button>
                  ) : (
                    <select
                      className={'rounded-full border-0 px-2 py-0.5 text-[11px] font-medium outline-none ' + statusStyle(r.status)}
                      value={r.status}
                      {...focus}
                      onChange={(e) => {
                        onPatch(r.id, { status: e.target.value })
                        setTimeout(() => onSave(r.id), 0)
                      }}
                    >
                      {COSTING_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="px-2 py-1">
                  <input className={editCls + ' text-left font-mono text-xs'} value={r.cash_sale_no} {...focus} onChange={(e) => onPatch(r.id, { cash_sale_no: e.target.value })} />
                </td>
                <td className="px-2 py-1 text-right">
                  <button onClick={() => onOpen(r.id)} className="rounded px-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Open full form (cost breakdown, commissions, sharing)">⋯</button>
                </td>
              </tr>
            )
          })}
          <tr className="border-t-2 border-slate-200 bg-slate-100 text-xs font-bold text-slate-700">
            <td className="sticky left-0 z-[1] border-r border-slate-200 bg-slate-100 px-2 py-2">Subtotal</td>
            {colSums.map((s, i) => (
              <td key={i} className="px-2 py-2 text-right">{nf(s)}</td>
            ))}
            <td className="px-2 py-2 text-right">{nf(sub.cost)}</td>
            <td className="px-2 py-2 text-right">{nf(sub.rev)}</td>
            <td className="px-2 py-2 text-right text-emerald-700">{nf(sub.gp)}</td>
            <td></td>
            <td className="px-2 py-2 text-right">{nf(sub.sh)}</td>
            <td colSpan={3}></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ---------- mobile card list (read-only) ----------
function Cards({ rows, progressOf, onOpen }: { rows: Costing[]; progressOf: (r: Costing) => UnitProgress | null; onOpen: (id: string) => void }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const c = calcCosting(r)
        const prog = progressOf(r)
        const status = prog?.status ?? r.status
        return (
          <li key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer rounded-xl bg-white p-4 shadow-sm active:bg-slate-50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-900">{r.cash_sale_no || '(no CS no.)'}</span>
                  <span className="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                    <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_ACCENT[r.category] ?? 'bg-slate-400'}`} />
                    {categoryLabel(r.category)}
                  </span>
                </div>
                <p className="mt-0.5 truncate font-medium text-slate-800">{r.customer || '—'}</p>
              </div>
              <div className="shrink-0 text-right">
                <div className={'font-semibold ' + (c.grossProfit < 0 ? 'text-rose-600' : 'text-emerald-600')}>{money(c.grossProfit)}</div>
                <div className={'text-xs ' + marginColor(c.margin)}>{c.margin.toFixed(1)}% margin</div>
              </div>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-400">Sale {money(num(r.revenue))} · cost {money(c.totalCost)}</p>
              {status && (
                <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle(status)}`}>
                  {prog && <span title="Synced from linked unit">🔗</span>}
                  {status}
                  {prog && <span className="opacity-60">{prog.percent}%</span>}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
