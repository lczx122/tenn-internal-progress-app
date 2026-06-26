import { useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Claim, Job, JobWork } from '../lib/types'
import { collectedTotal, money, perTradeRows, UNALLOCATED } from '../lib/claims'
import { formatDate } from '../lib/format'
import { Icon } from './Icon'

// The claim-entry modes shown in the dropdown. Percentage modes show the live
// ringgit value based on the unit's order total.
type Mode =
  | 'Booking Fee / Deposit'
  | '50% Collected'
  | '100% Collected'
  | 'Custom amount'
  | 'Custom %'

const MODES: Mode[] = ['Booking Fee / Deposit', '50% Collected', '100% Collected', 'Custom amount', 'Custom %']

function isPercentMode(m: Mode) {
  return m === '50% Collected' || m === '100% Collected' || m === 'Custom %'
}

// Resolve a mode + entered value to { amount, percent, category }.
function resolve(mode: Mode, value: string, orderTotal: number) {
  const v = parseFloat(value) || 0
  switch (mode) {
    case '50% Collected':
      return { amount: orderTotal * 0.5, percent: 50, category: '50% Collected' }
    case '100% Collected':
      return { amount: orderTotal * 1, percent: 100, category: '100% Collected' }
    case 'Custom %':
      return { amount: (orderTotal * v) / 100, percent: v, category: 'Custom' }
    case 'Booking Fee / Deposit':
      return { amount: v, percent: null as number | null, category: 'Booking Fee / Deposit' }
    case 'Custom amount':
    default:
      return { amount: v, percent: null as number | null, category: 'Custom' }
  }
}

export function ClaimsSection({
  job,
  claims,
  works,
  displayName,
  session,
  isAdmin,
  onChange,
}: {
  job: Job
  claims: Claim[]
  works: JobWork[]
  displayName: string
  session: Session | null
  isAdmin: boolean
  onChange: () => void | Promise<void>
}) {
  const [orderTotal, setOrderTotal] = useState(String(job.order_total || ''))
  const [mode, setMode] = useState<Mode>('Booking Fee / Deposit')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const [workCat, setWorkCat] = useState('')
  const [busy, setBusy] = useState(false)

  // The unit's trades: its work cards, plus any category that already has an
  // order amount (e.g. seeded from a Sales Order but no card yet).
  const tradeCats = useMemo(() => {
    const out: string[] = []
    const seen = new Set<string>()
    for (const w of works) {
      const c = (w.category || '').trim()
      if (c && !seen.has(c)) { seen.add(c); out.push(c) }
    }
    for (const k of Object.keys(job.order_by_category ?? {})) {
      if (!seen.has(k)) { seen.add(k); out.push(k) }
    }
    return out
  }, [works, job.order_by_category])

  const [showByTrade, setShowByTrade] = useState(false)
  const [obc, setObc] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const [k, v] of Object.entries(job.order_by_category ?? {})) o[k] = v ? String(v) : ''
    return o
  })

  const total = Number(orderTotal) || 0
  const collected = collectedTotal(claims)
  const balance = total - collected
  const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0

  const tradeRows = perTradeRows(job, claims)

  // When a collection is tagged to a trade that has its own order amount, the
  // percentage modes (50% / 100% / Custom %) are of THAT trade, not the whole unit.
  const tradeOrder = workCat ? Number(job.order_by_category?.[workCat] || 0) : 0
  const pctBase = tradeOrder > 0 ? tradeOrder : total
  const preview = resolve(mode, value, pctBase)
  const needsValue = mode === 'Booking Fee / Deposit' || mode === 'Custom amount' || mode === 'Custom %'

  async function saveOrderTotal() {
    const v = Number(orderTotal) || 0
    if (v === Number(job.order_total)) return
    setBusy(true)
    await supabase.from('jobs').update({ order_total: v, updated_by: displayName }).eq('id', job.id)
    await onChange()
    setBusy(false)
  }

  async function saveOrderByTrade() {
    const map: Record<string, number> = {}
    let sum = 0
    for (const c of tradeCats) {
      const v = Number(obc[c] || 0) || 0
      if (v > 0) { map[c] = v; sum += v }
    }
    setBusy(true)
    await supabase
      .from('jobs')
      .update({ order_by_category: map, order_total: sum, updated_by: displayName })
      .eq('id', job.id)
    setOrderTotal(String(sum || ''))
    await onChange()
    setBusy(false)
  }

  async function addClaim() {
    if (!(preview.amount > 0)) {
      alert('Enter an amount greater than zero.')
      return
    }
    setBusy(true)
    await supabase.from('claims').insert({
      job_id: job.id,
      category: preview.category,
      work_category: workCat || null,
      amount: preview.amount,
      percent: preview.percent,
      note: note.trim(),
      collected_on: date || null,
      created_by: session?.user.id ?? null,
      created_by_name: displayName,
    })
    setValue('')
    setNote('')
    setDate('')
    await onChange()
    setBusy(false)
  }

  async function removeClaim(c: Claim) {
    if (!window.confirm(`Remove this ${money(c.amount)} collection?`)) return
    setBusy(true)
    await supabase.from('claims').delete().eq('id', c.id)
    await onChange()
    setBusy(false)
  }

  const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900'

  return (
    <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Icon name="cash" className="h-4 w-4 text-emerald-600" /> Customer collection</h2>

      {/* Order total + progress */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-slate-500">Total order amount</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">RM</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={orderTotal}
              onChange={(e) => setOrderTotal(e.target.value)}
              className={`${inp} pl-10`}
              placeholder="0.00"
            />
          </div>
          <button
            onClick={saveOrderTotal}
            disabled={busy || Number(orderTotal || 0) === Number(job.order_total)}
            className="shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white active:bg-slate-700 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-slate-50 p-2">
          <div className="text-[11px] text-slate-400">Order</div>
          <div className="font-semibold text-slate-800">{money(total)}</div>
        </div>
        <div className="rounded-lg bg-emerald-50 p-2">
          <div className="text-[11px] text-emerald-700/70">Collected</div>
          <div className="font-semibold text-emerald-700">{money(collected)}</div>
        </div>
        <div className="rounded-lg bg-amber-50 p-2">
          <div className="text-[11px] text-amber-700/70">Balance</div>
          <div className="font-semibold text-amber-700">{money(balance)}</div>
        </div>
      </div>
      <div className="mb-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Per-trade breakdown */}
      {tradeRows.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <th className="px-2 py-1.5 text-left font-semibold">By trade</th>
                <th className="px-2 py-1.5 text-right font-semibold">Order</th>
                <th className="px-2 py-1.5 text-right font-semibold">Collected</th>
                <th className="px-2 py-1.5 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {tradeRows.map((r) => (
                <tr key={r.cat} className="border-b border-slate-100 last:border-0">
                  <td className="truncate px-2 py-1.5 font-medium text-slate-700">{r.cat}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{r.order ? money(r.order) : '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-medium text-emerald-700">{money(r.collected)}</td>
                  <td className={'px-2 py-1.5 text-right tabular-nums ' + (r.balance > 0 ? 'font-medium text-amber-700' : 'text-slate-400')}>
                    {r.cat === UNALLOCATED ? '—' : money(r.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Order-by-trade editor */}
      {tradeCats.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowByTrade((s) => !s)}
            className="text-xs font-medium text-slate-500 active:text-slate-700"
          >
            {showByTrade ? '▾' : '▸'} Set order amount by trade
          </button>
          {showByTrade && (
            <div className="mt-2 space-y-2 rounded-lg border border-slate-200 p-3">
              {tradeCats.map((c) => (
                <div key={c} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{c}</span>
                  <div className="relative w-36 shrink-0">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">RM</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={obc[c] ?? ''}
                      onChange={(e) => setObc({ ...obc, [c]: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-2 text-sm outline-none focus:border-slate-900"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={saveOrderByTrade}
                disabled={busy}
                className="w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white active:bg-slate-700 disabled:opacity-50"
              >
                Save order by trade (sets the total)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Claim list */}
      {claims.length > 0 && (
        <ul className="mb-4 space-y-2">
          {claims.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {c.category}
                  {c.percent != null && <span className="text-slate-400"> · {c.percent}%</span>}
                  {c.work_category && <span className="text-slate-400"> · {c.work_category}</span>}
                </p>
                <p className="text-xs text-slate-400">
                  {c.collected_on ? formatDate(c.collected_on) : formatDate(c.created_at)}
                  {c.created_by_name ? ` · ${c.created_by_name}` : ''}
                  {c.note ? ` · ${c.note}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold text-emerald-700">{money(c.amount)}</span>
                {isAdmin && (
                  <button onClick={() => removeClaim(c)} className="text-xs text-slate-300 active:text-red-500">
                    ✕
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add a claim */}
      <div className="rounded-lg border border-slate-200 p-3">
        <label className="mb-1 block text-xs font-medium text-slate-500">Record a collection</label>
        <select value={mode} onChange={(e) => { setMode(e.target.value as Mode); setValue('') }} className={`${inp} mb-2`}>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        {tradeCats.length > 0 && (
          <select value={workCat} onChange={(e) => setWorkCat(e.target.value)} className={`${inp} mb-2`}>
            <option value="">For: whole unit (unallocated)</option>
            {tradeCats.map((c) => (
              <option key={c} value={c}>
                For: {c}
              </option>
            ))}
          </select>
        )}

        {needsValue && (
          <div className="relative mb-2">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
              {mode === 'Custom %' ? '%' : 'RM'}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={`${inp} pl-10`}
              placeholder={mode === 'Custom %' ? 'e.g. 25' : '0.00'}
            />
          </div>
        )}

        {(isPercentMode(mode) || mode === 'Booking Fee / Deposit') && (
          <p className="mb-2 text-sm text-slate-500">
            {isPercentMode(mode) ? (
              <>
                {mode === 'Custom %' ? `${parseFloat(value) || 0}%` : mode.replace(' Collected', '')} of {money(pctBase)}
                {tradeOrder > 0 && <span className="text-slate-400"> ({workCat})</span>} ={' '}
                <span className="font-semibold text-slate-800">{money(preview.amount)}</span>
              </>
            ) : (
              'Enter the booking fee / deposit amount.'
            )}
          </p>
        )}

        <div className="mb-2 flex gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inp}
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className={inp}
          />
        </div>

        <button
          onClick={addClaim}
          disabled={busy || !(preview.amount > 0)}
          className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-50"
        >
          Add collection {preview.amount > 0 ? `· ${money(preview.amount)}` : ''}
        </button>
      </div>
    </section>
  )
}
