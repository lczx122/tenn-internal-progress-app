import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { realtimeChannel } from '../lib/realtime'
import { useAuth } from '../contexts/AuthContext'
import type { Supplier } from '../lib/types'
import { Layout } from '../components/Layout'
import { useAutoRefresh } from '../lib/useAutoRefresh'

// Boss-only management of the reusable supplier master list (public.suppliers).
// Mirrors ProjectsAdmin: add / rename / delete, with a usage count from
// unit_suppliers and delete blocked while a supplier is still in use.
export default function SuppliersAdmin() {
  const { isBoss } = useAuth()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const [{ data: s }, { data: u }] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('unit_suppliers').select('supplier'),
    ])
    setSuppliers((s as Supplier[]) ?? [])
    const c: Record<string, number> = {}
    for (const row of (u as { supplier: string }[]) ?? []) {
      if (row.supplier) c[row.supplier] = (c[row.supplier] ?? 0) + 1
    }
    setCounts(c)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = realtimeChannel('suppliers-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_suppliers' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  useAutoRefresh(load)

  async function add(e: FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('suppliers').insert({ name: n })
    if (error) setError(error.code === '23505' ? 'That supplier already exists.' : error.message)
    else setName('')
    await load()
    setBusy(false)
  }

  async function rename(s: Supplier) {
    const next = window.prompt('Rename supplier', s.name)
    if (next == null) return
    const n = next.trim()
    if (!n || n === s.name) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('suppliers').update({ name: n }).eq('id', s.id)
    if (error) {
      setError(error.code === '23505' ? 'A supplier with that name already exists.' : error.message)
    } else {
      // Keep unit entries pointing at the renamed supplier.
      await supabase.from('unit_suppliers').update({ supplier: n }).eq('supplier', s.name)
    }
    await load()
    setBusy(false)
  }

  async function remove(s: Supplier) {
    const used = counts[s.name] ?? 0
    if (used > 0) {
      setError(`Can't delete “${s.name}” — used on ${used} unit entr${used === 1 ? 'y' : 'ies'}. Remove those first.`)
      return
    }
    if (!window.confirm(`Delete supplier “${s.name}”?`)) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('suppliers').delete().eq('id', s.id)
    if (error) setError(error.message)
    await load()
    setBusy(false)
  }

  if (!isBoss) {
    return (
      <Layout title="Suppliers" back={<BackLink />}>
        <p className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">Boss only.</p>
      </Layout>
    )
  }

  return (
    <Layout title="Suppliers" back={<BackLink />} onRefresh={load}>
      <p className="mb-3 px-1 text-xs text-slate-500">
        Your reusable supplier list. Suppliers you type on a unit are added here automatically; rename or remove them
        here. Renaming updates every unit that uses that supplier.
      </p>

      <form onSubmit={add} className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New supplier name…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-slate-900"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white active:bg-slate-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : suppliers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          No suppliers yet. Add one above, or they'll appear as you enter them on units.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {suppliers.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-3 shadow-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-400">
                  {(counts[s.name] ?? 0)} {(counts[s.name] ?? 0) === 1 ? 'entry' : 'entries'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => rename(s)}
                  disabled={busy}
                  className="text-xs font-medium text-slate-500 underline disabled:opacity-50"
                >
                  Rename
                </button>
                <button
                  onClick={() => remove(s)}
                  disabled={busy}
                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 active:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  )
}

function BackLink() {
  return (
    <Link to="/" className="text-xl leading-none text-slate-300">
      ←
    </Link>
  )
}
