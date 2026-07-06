import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Job, UnitSupplier } from '../lib/types'
import { SUPPLIER_STAGES, getSupplierStage, supplierPercent } from '../lib/supplierStages'
import { CATEGORIES, getCategory } from '../lib/categories'
import { PercentBar } from './StageBar'
import { Icon } from './Icon'
import { money } from '../lib/claims'
import { formatDate } from '../lib/format'

const inp = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900'

// Boss-only per-unit tracker of the suppliers fulfilling a unit's materials, each
// tagged to a trade and with a fulfilment status, cost and expected date. Supplier
// names come from a reusable master list (public.suppliers) that autocompletes
// across units. Mirrors ClaimsSection: parent owns `suppliers`, refetch via onChange.
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
  const [supplierNames, setSupplierNames] = useState<string[]>([])
  const [form, setForm] = useState({
    supplier: '',
    item: '',
    category: CATEGORIES[0].key,
    stage: 'to_order',
    cost: '',
    expected_date: '',
    notes: '',
  })
  const set = <K extends keyof typeof form>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  async function loadNames() {
    const { data } = await supabase.from('suppliers').select('name').order('name')
    setSupplierNames(((data as { name: string }[]) ?? []).map((r) => r.name))
  }
  useEffect(() => {
    loadNames()
  }, [])

  const total = suppliers.reduce((s, x) => s + Number(x.cost || 0), 0)
  const pct = supplierPercent(suppliers.map((s) => s.stage))

  // Group the entries by trade, ordered by CATEGORIES; unknown/untagged last.
  const groups = useMemo(() => {
    const byCat = new Map<string, UnitSupplier[]>()
    for (const s of suppliers) {
      const k = s.category || ''
      if (!byCat.has(k)) byCat.set(k, [])
      byCat.get(k)!.push(s)
    }
    const order: string[] = []
    for (const c of CATEGORIES) if (byCat.has(c.key)) order.push(c.key)
    for (const k of byCat.keys()) if (!order.includes(k)) order.push(k)
    return order.map((cat) => ({ cat, rows: byCat.get(cat)! }))
  }, [suppliers])

  async function addRow() {
    if (!form.supplier.trim()) return
    const name = form.supplier.trim()
    setBusy(true)
    await supabase.from('unit_suppliers').insert({
      job_id: job.id,
      supplier: name,
      item: form.item.trim(),
      category: form.category,
      stage: form.stage,
      cost: Number(form.cost) || 0,
      expected_date: form.expected_date || null,
      notes: form.notes.trim(),
      created_by: session?.user.id ?? null,
    })
    // Save the name to the reusable master list (no-op if it already exists).
    await supabase
      .from('suppliers')
      .upsert({ name, created_by: session?.user.id ?? null }, { onConflict: 'name', ignoreDuplicates: true })
    setForm({ supplier: '', item: '', category: form.category, stage: 'to_order', cost: '', expected_date: '', notes: '' })
    setAdding(false)
    setBusy(false)
    await loadNames()
    await onChange()
  }

  async function patch(s: UnitSupplier, fields: Partial<UnitSupplier>) {
    setBusy(true)
    await supabase.from('unit_suppliers').update(fields).eq('id', s.id)
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
        <div className="flex items-center gap-3">
          <Link to="/suppliers" className="text-xs font-medium text-slate-500 underline">
            Manage
          </Link>
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white active:bg-slate-700"
          >
            {adding ? 'Close' : '+ Supplier'}
          </button>
        </div>
      </div>

      {/* Shared autocomplete of reusable supplier names (across all units). */}
      <datalist id="supplierList">
        {supplierNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

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
          <input list="supplierList" className={inp} placeholder="Supplier name" value={form.supplier} onChange={(e) => set('supplier', e.target.value)} />
          <input className={inp} placeholder="Item / what they supply" value={form.item} onChange={(e) => set('item', e.target.value)} />
          <label className="block text-xs text-slate-500">
            Trade
            <select className={inp} value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
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
        <div className="space-y-4">
          {groups.map(({ cat, rows }) => {
            const c = getCategory(cat)
            const sub = rows.reduce((n, r) => n + Number(r.cost || 0), 0)
            return (
              <div key={cat || 'untagged'}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${c.accent}`}>
                    {cat ? c.label : 'Untagged'}
                  </span>
                  {sub > 0 && <span className="text-xs tabular-nums text-slate-400">{money(sub)}</span>}
                </div>
                <ul className="space-y-2">
                  {rows.map((s) => (
                    <SupplierRow
                      key={s.id}
                      s={s}
                      busy={busy}
                      onStage={(stage) => patch(s, { stage })}
                      onCategory={(category) => patch(s, { category })}
                      onSaveNotes={(notes) => patch(s, { notes })}
                      onDelete={() => remove(s)}
                    />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function SupplierRow({
  s,
  busy,
  onStage,
  onCategory,
  onSaveNotes,
  onDelete,
}: {
  s: UnitSupplier
  busy: boolean
  onStage: (stage: string) => void
  onCategory: (category: string) => void
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
        <div className="mt-2 flex items-center justify-between gap-2">
          <button onClick={() => setEditing(true)} className="min-w-0 flex-1 truncate text-left text-xs text-slate-500">
            {s.notes ? s.notes : <span className="text-slate-400">+ Add notes</span>}
          </button>
          <select
            value={s.category || ''}
            disabled={busy}
            onChange={(e) => onCategory(e.target.value)}
            title="Move to trade"
            className="shrink-0 rounded-lg border border-slate-300 px-1.5 py-1 text-[11px] text-slate-600"
          >
            <option value="">Untagged</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <button onClick={onDelete} className="shrink-0 text-xs font-medium text-red-600 active:text-red-700">
            Remove
          </button>
        </div>
      )}
    </li>
  )
}
