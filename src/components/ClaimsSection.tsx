import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Claim, Job } from '../lib/types'
import { collectedTotal, money } from '../lib/claims'
import { formatDate } from '../lib/format'

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
  displayName,
  session,
  isAdmin,
  onChange,
}: {
  job: Job
  claims: Claim[]
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
  const [busy, setBusy] = useState(false)

  const total = Number(orderTotal) || 0
  const collected = collectedTotal(claims)
  const balance = total - collected
  const pct = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0

  const preview = resolve(mode, value, total)
  const needsValue = mode === 'Booking Fee / Deposit' || mode === 'Custom amount' || mode === 'Custom %'

  async function saveOrderTotal() {
    const v = Number(orderTotal) || 0
    if (v === Number(job.order_total)) return
    setBusy(true)
    await supabase.from('jobs').update({ order_total: v, updated_by: displayName }).eq('id', job.id)
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
      <h2 className="mb-3 text-sm font-semibold text-slate-700">💰 Customer claims</h2>

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

      {/* Claim list */}
      {claims.length > 0 && (
        <ul className="mb-4 space-y-2">
          {claims.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {c.category}
                  {c.percent != null && <span className="text-slate-400"> · {c.percent}%</span>}
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
                {mode === 'Custom %' ? `${parseFloat(value) || 0}%` : mode.replace(' Collected', '')} of {money(total)} ={' '}
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
