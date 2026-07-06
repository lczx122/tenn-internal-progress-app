import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Job, UnitSupplier } from '../lib/types'
import { SUPPLIER_STAGES, getSupplierStage, supplierPercent } from '../lib/supplierStages'
import { PercentBar } from './StageBar'
import { Icon } from './Icon'
import { money } from '../lib/claims'
import { formatDate } from '../lib/format'

const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900'

// Boss-only per-unit tracker of the suppliers fulfilling a unit's materials, each
// with a fulfilment status, cost and expected date. Mirrors ClaimsSection: parent
// owns the `suppliers` array and refetches via onChange after every write.
export function SupplierSection({
  job,
  suppliers,
  session,
  onChange,
}: {
  job: Job
  suppliers: UnitSupplier[]
  session: Session | null
  onChange: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ supplier: '', item: '', stage: 'to_order', cost: '', expected_date: '', notes: '' })
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const total = suppliers.reduce((s, x) => s + Number(x.cost || 0), 0)
  const pct = supplierPercent(suppliers.map((s) => s.stage))

  async function addRow() {
    if (!form.supplier.trim()) return
    setBusy(true)
    await supabase.from('unit_suppliers').insert({
      job_id: job.id,
      supplier: form.supplier.trim(),
      item: form.item.trim(),
      stage: form.stage,
      cost: Number(form.cost) || 0,
      expected_date: form.expected_date || null,
      notes: form.notes.trim(),
      created_by: session?.user.id ?? null,
    })
    setForm({ supplier: '', item: '', stage: 'to_order', cost: '', expected_date: '', notes: '' })
    setAdding(false)
    setBusy(false)
    await onChange()
  }

  async function setStage(s: UnitSupplier, stage: string) {
    setBusy(true)
    await supabase.from('unit_suppliers').update({ stage }).eq('id', s.id)
    setBusy(false)
    await onChange()
  }

  async function saveNotes(s: UnitSupplier, notes: string) {
    setBusy(true)
    await supabase.from('unit_suppliers').update({ notes }).eq('id', s.id)
    setBusy(false)
    await onChange()
  }

  async function remove(s: UnitSupplier) {
    if (!window.confirm(`Remove supplier "${s.supplier || '—'}"?`)) return
    setBusy(true)
    await supabase.from('unit_suppliers').delete().eq('id', s.id)
    setBusy(false)
    await onChange()
  }

  return (
    <section className="mt-4 rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Icon name="truck" className="h-4 w-4 text-slate-400" /> Supplier progress
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">BOSS</span>
        </h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white active:bg-slate-700"
        >
          {adding ? 'Close' : '+ Supplier'}
        </button>
      </div>

      {suppliers.length > 0 && (
        <div className="mb-3 space-y-2">
          <PercentBar percent={pct} label={`Overall · ${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'}`} />
          <div className="flex justify-between text-xs text-slate-500">
            <span>Total supplier cost</span>
            <span className="font-semibold tabular-nums text-slate-700">{money(total)}</span>
          </div>
        </div>
      )}

      {adding && (
        <div className="mb-3 space-y-2 rounded-lg border border-slate-200 p-3">
          <input className={inp} placeholder="Supplier name" value={form.supplier} onChange={(e) => set('supplier', e.target.value)} />
          <input className={inp} placeholder="Item / what they supply" value={form.item} onChange={(e) => set('item', e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <select className={inp} value={form.stage} onChange={(e) => set('stage', e.target.value)}>
              {SUPPLIER_STAGES.map((st) => (
                <option key={st.key} value={st.key}>
                  {st.label}
                </option>
              ))}
            </select>
            <input type="number" min="0" step="0.01" className={inp} placeholder="Cost (RM)" value={form.cost} onChange={(e) => set('cost', e.target.value)} />
          </div>
          <label className="block text-xs text-slate-500">
            Expected date
            <input type="date" className={inp} value={form.expected_date} onChange={(e) => set('expected_date', e.target.value)} />
          </label>
          <textarea rows={2} className={inp} placeholder="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          <button
            disabled={busy || !form.supplier.trim()}
            onClick={addRow}
            className="w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white active:bg-slate-700 disabled:opacity-60"
          >
            Add supplier
          </button>
        </div>
      )}

      {suppliers.length === 0 && !adding ? (
        <p className="py-6 text-center text-sm text-slate-400">No suppliers tracked yet.</p>
      ) : (
        <ul className="space-y-2">
          {suppliers.map((s) => (
            <SupplierRow key={s.id} s={s} busy={busy} onStage={(st) => setStage(s, st)} onSaveNotes={(n) => saveNotes(s, n)} onDelete={() => remove(s)} />
          ))}
        </ul>
      )}
    </section>
  )
}

function SupplierRow({
  s,
  busy,
  onStage,
  onSaveNotes,
  onDelete,
}: {
  s: UnitSupplier
  busy: boolean
  onStage: (stage: string) => void
  onSaveNotes: (notes: string) => void
  onDelete: () => void
}) {
  const [notes, setNotes] = useState(s.notes)
  const [editing, setEditing] = useState(false)
  const st = getSupplierStage(s.stage)

  return (
    <li className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{s.supplier || '—'}</p>
          {s.item && <p className="truncate text-xs text-slate-500">{s.item}</p>}
        </div>
        <div className="shrink-0 text-right">
          {Number(s.cost) > 0 && <p className="text-sm font-semibold tabular-nums text-slate-800">{money(Number(s.cost))}</p>}
          {s.expected_date && <p className="text-xs text-slate-400">{formatDate(s.expected_date)}</p>}
        </div>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full rounded-full transition-all duration-500 ${st.color}`} style={{ width: `${st.percent}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUPPLIER_STAGES.map((x) => (
          <button
            key={x.key}
            disabled={busy}
            onClick={() => onStage(x.key)}
            className={
              'rounded-full border px-2 py-0.5 text-[11px] font-medium ' +
              (x.key === s.stage
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-600 active:bg-slate-50')
            }
          >
            {x.label}
          </button>
        ))}
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea rows={2} className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex gap-2">
            <button
              onClick={() => {
                onSaveNotes(notes.trim())
                setEditing(false)
              }}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white active:bg-slate-700"
            >
              Save
            </button>
            <button
              onClick={() => {
                setNotes(s.notes)
                setEditing(false)
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 active:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-start justify-between gap-2">
          <button onClick={() => setEditing(true)} className="min-w-0 flex-1 text-left text-xs text-slate-500">
            {s.notes ? s.notes : <span className="text-slate-400">+ Add notes</span>}
          </button>
          <button onClick={onDelete} className="shrink-0 text-xs font-medium text-red-600 active:text-red-700">
            Remove
          </button>
        </div>
      )}
    </li>
  )
}
