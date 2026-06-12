import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { DocType, Quotation } from '../lib/types'
import { Layout } from '../components/Layout'
import { relativeTime } from '../lib/format'
import { useAutoRefresh } from '../lib/useAutoRefresh'

const money = (n: number) =>
  'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Filter = 'all' | DocType

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'QT', label: 'Quotations' },
  { key: 'SO', label: 'Sales Orders' },
]

export default function QuotesRegister() {
  const [rows, setRows] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const { isAdmin } = useAuth()
  const navigate = useNavigate()

  async function remove(r: Quotation) {
    if (!window.confirm(`Delete ${r.number}? This cannot be undone.`)) return
    await supabase.from('quotations').delete().eq('id', r.id)
  }

  async function load() {
    const { data } = await supabase
      .from('quotations')
      .select('*')
      .order('created_at', { ascending: false })
    setRows((data as Quotation[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('quotations-register')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Refetch after waking from idle (realtime socket may have died).
  useAutoRefresh(load)

  // Map id -> number so a sales order can show the quotation it came from.
  const numberById = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rows) m.set(r.id, r.number)
    return m
  }, [rows])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows
      .filter((r) => filter === 'all' || r.doc_type === filter)
      .filter(
        (r) =>
          !q ||
          r.number.toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q) ||
          r.prepared_by.toLowerCase().includes(q) ||
          r.categories.toLowerCase().includes(q),
      )
  }, [rows, query, filter])

  const total = useMemo(() => visible.reduce((s, r) => s + Number(r.total || 0), 0), [visible])

  return (
    <Layout title="Orders" bottomNav onRefresh={load}>
      <div className="mb-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search number, customer, staff…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <button
          onClick={() => navigate('/quote')}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white active:bg-slate-700"
        >
          + New
        </button>
      </div>

      <div className="mb-3 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              'flex-1 rounded-lg border px-2 py-2 text-sm font-medium ' +
              (filter === f.key
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-300 bg-white text-slate-600 active:bg-slate-50')
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          {rows.length === 0
            ? 'No saved documents yet. Build one in the Quote tab and tap “Save”.'
            : 'Nothing matches your filter.'}
        </div>
      ) : (
        <>
          <p className="mb-2 px-1 text-xs text-slate-400">
            {visible.length} {visible.length === 1 ? 'document' : 'documents'} · {money(total)} total
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((r) => {
              const isSO = r.doc_type === 'SO'
              return (
                <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            'rounded px-1.5 py-0.5 text-[10px] font-bold ' +
                            (isSO ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700')
                          }
                        >
                          {isSO ? 'SO' : 'QT'}
                        </span>
                        <span className="font-mono text-sm font-semibold text-slate-900">{r.number}</span>
                      </div>
                      <p className="mt-1 truncate font-medium text-slate-800">{r.customer_name || '—'}</p>
                    </div>
                    <span className="shrink-0 font-semibold text-slate-900">{money(Number(r.total))}</span>
                  </div>

                  {isSO && r.source_id && numberById.has(r.source_id) && (
                    <p className="mt-1.5 text-xs text-slate-400">From quote {numberById.get(r.source_id)}</p>
                  )}
                  {r.categories && <p className="mt-1.5 truncate text-xs text-slate-500">{r.categories}</p>}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">
                      {r.prepared_by ? `By ${r.prepared_by} · ` : ''}
                      {relativeTime(r.created_at)}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {!isSO && (
                        <button
                          onClick={() => navigate(`/quote?from=${r.id}&type=SO`)}
                          className="rounded-lg border border-emerald-600 px-2.5 py-1 text-xs font-medium text-emerald-700 active:bg-emerald-50"
                        >
                          → Convert to SO
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => remove(r)}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 active:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Layout>
  )
}
