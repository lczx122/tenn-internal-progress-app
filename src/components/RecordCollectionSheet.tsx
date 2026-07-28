import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Job } from '../lib/types'
import {
  money,
  CLAIM_MODES,
  type ClaimMode,
  isPercentMode,
  resolveClaim,
  modeNeedsValue,
} from '../lib/claims'
import { runDb, toastErr } from '../lib/toast'

// Quick "record a collection" bottom sheet — reachable straight from the Money
// tab and Dashboard, so logging cash doesn't require finding the unit page and
// scrolling to its collection form. Same modes/resolution as ClaimsSection.
export function RecordCollectionSheet({
  jobs,
  onClose,
  onSaved,
}: {
  jobs: Job[] // active units to pick from
  onClose: () => void
  onSaved?: () => void | Promise<void>
}) {
  const { displayName, session } = useAuth()
  const [q, setQ] = useState('')
  const [job, setJob] = useState<Job | null>(null)
  const [mode, setMode] = useState<ClaimMode>('Booking Fee / Deposit')
  const [value, setValue] = useState('')
  const [workCat, setWorkCat] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    return jobs
      .filter((j) => !j.is_archived)
      .filter(
        (j) =>
          !s ||
          (j.unit_code || '').toLowerCase().includes(s) ||
          j.customer_name.toLowerCase().includes(s) ||
          (j.project || '').toLowerCase().includes(s),
      )
      .slice(0, 30)
  }, [jobs, q])

  // Trades come from the unit's per-trade order amounts (seeded by its SO).
  const tradeCats = useMemo(() => Object.keys(job?.order_by_category ?? {}), [job])

  const total = Number(job?.order_total || 0)
  const tradeOrder = workCat ? Number(job?.order_by_category?.[workCat] || 0) : 0
  const pctBase = tradeOrder > 0 ? tradeOrder : total
  const preview = resolveClaim(mode, value, pctBase)
  const needsValue = modeNeedsValue(mode)

  async function save() {
    if (!job) return
    if (!(preview.amount > 0)) {
      toastErr('Enter an amount greater than zero.')
      return
    }
    setBusy(true)
    const ok = await runDb(
      supabase.from('claims').insert({
        job_id: job.id,
        category: preview.category,
        work_category: workCat || null,
        amount: preview.amount,
        percent: preview.percent,
        note: note.trim(),
        collected_on: date || null,
        created_by: session?.user.id ?? null,
        created_by_name: displayName,
      }),
      { ok: `${money(preview.amount)} recorded — ${job.unit_code || job.customer_name}`, fail: 'Collection NOT recorded' },
    )
    setBusy(false)
    if (ok) {
      await onSaved?.()
      onClose()
    }
  }

  const inp = 'w-full rounded-lg border border-line-2 bg-surface px-3 py-2.5 text-base outline-none focus:border-strong'
  const lbl = 'mb-1 block text-xs font-medium text-muted-2'

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-4 shadow-xl sm:rounded-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Record collection</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-[40px] min-w-[40px] rounded-lg text-faint active:bg-press"
          >
            ✕
          </button>
        </div>

        {!job ? (
          <>
            {/* Step 1 — pick the unit */}
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search unit or customer…"
              className={inp}
            />
            <ul className="mt-2 divide-y divide-line-faint">
              {matches.map((j) => (
                <li key={j.id}>
                  <button
                    onClick={() => setJob(j)}
                    className="flex w-full items-center justify-between gap-2 px-1 py-2.5 text-left active:bg-press"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-2">
                        {j.unit_code || j.customer_name}
                      </span>
                      <span className="block truncate text-xs text-muted-2">
                        {j.unit_code ? j.customer_name : j.project}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-faint">{money(Number(j.order_total || 0))}</span>
                  </button>
                </li>
              ))}
              {matches.length === 0 && (
                <li className="py-8 text-center text-sm text-faint">No active unit matches “{q}”.</li>
              )}
            </ul>
          </>
        ) : (
          <>
            {/* Step 2 — the collection */}
            <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink-2">
                  {job.unit_code || job.customer_name}
                </span>
                <span className="block truncate text-xs text-muted-2">
                  {job.customer_name} · order {money(total)}
                </span>
              </span>
              <button onClick={() => setJob(null)} className="shrink-0 text-xs font-medium text-muted-2 underline">
                Change
              </button>
            </div>

            {tradeCats.length > 0 && (
              <div className="mb-3">
                <label className={lbl}>Trade (optional)</label>
                <select value={workCat} onChange={(e) => setWorkCat(e.target.value)} className={inp}>
                  <option value="">— Whole unit —</option>
                  {tradeCats.map((c) => (
                    <option key={c} value={c}>
                      {c} · {money(Number(job.order_by_category?.[c] || 0))}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className={lbl}>Type</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as ClaimMode)} className={inp}>
                {CLAIM_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {needsValue && (
              <div className="mb-3">
                <label className={lbl}>{isPercentMode(mode) ? 'Percent of order' : 'Amount (RM)'}</label>
                <input
                  type="number" inputMode="decimal"
                  min="0"
                  step={isPercentMode(mode) ? '0.1' : '0.01'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className={inp}
                  placeholder={isPercentMode(mode) ? 'e.g. 30' : '0.00'}
                />
              </div>
            )}

            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Collected on (optional)</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Note (optional)</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} className={inp} placeholder="e.g. cash" />
              </div>
            </div>

            <button
              onClick={save}
              disabled={busy || !(preview.amount > 0)}
              className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : `Record ${preview.amount > 0 ? money(preview.amount) : 'collection'}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
