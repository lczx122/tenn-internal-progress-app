import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { realtimeChannel, coalesce } from '../lib/realtime'
import { useAuth } from '../contexts/AuthContext'
import type { DocType, Quotation } from '../lib/types'
import { Layout } from '../components/Layout'
import { LoadingState, EmptyState , SearchInput , Segmented } from '../components/ui'
import { relativeTime } from '../lib/format'
import { money } from '../lib/claims'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { cacheGet, cacheSet } from '../lib/pageCache'
import { progressStart, progressDone } from '../lib/progress'
import { usePersistedState, oneOf } from '../lib/usePersistedState'
import { runDb } from '../lib/toast'
import { confirmDialog } from '../lib/dialog'
import { ErrorState } from '../components/ErrorState'

type Filter = 'all' | DocType

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'QT', label: 'Quotations' },
  { key: 'SO', label: 'Sales Orders' },
]

export default function QuotesRegister() {
  const c0 = cacheGet<Quotation[]>('quotes')
  const [rows, setRows] = useState<Quotation[]>(c0 ?? [])
  const [loading, setLoading] = useState(!c0)
  const [loadFailed, setLoadFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = usePersistedState<Filter>('tenn_quotes_filter', 'all', {
    validate: oneOf('all', 'QT', 'SO'),
  })
  const { isAdmin, session } = useAuth()
  const userId = session?.user?.id ?? null
  const navigate = useNavigate()

  async function remove(r: Quotation) {
    if (
      !(await confirmDialog({
        title: `Delete ${r.number}`,
        message: `Delete ${r.number}${r.unit ? ` (${r.unit})` : ''}? ${
          r.doc_type === 'SO' ? 'Its unit keeps its history, but this order is gone for good.' : 'This cannot be undone.'
        }`,
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return
    const ok = await runDb(supabase.from('quotations').delete().eq('id', r.id), {
      ok: `${r.number} deleted`,
      fail: 'Could not delete',
    })
    // Remove locally too — realtime may be down, and the row lingering after a
    // confirmed delete reads as "it didn't work".
    if (ok) setRows((prev) => prev.filter((x) => x.id !== r.id))
  }

  async function load(quiet = false) {
    if (!quiet) progressStart()
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false })
      setLoadFailed(!!error)
      if (!error) {
        const next = (data as Quotation[]) ?? []
        setRows(next)
        cacheSet('quotes', next)
      }
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
      if (!quiet) progressDone()
    }
  }

  useEffect(() => {
    load()
    // One quiet refetch per burst of realtime events (no progress-bar sweep).
    const rt = coalesce(() => load(true))
    const channel = realtimeChannel('quotations-register')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, rt.run)
      .subscribe()
    return () => {
      rt.cancel()
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
          (r.unit || '').toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q) ||
          r.prepared_by.toLowerCase().includes(q) ||
          r.categories.toLowerCase().includes(q),
      )
  }, [rows, query, filter])

  const total = useMemo(() => visible.reduce((s, r) => s + Number(r.total || 0), 0), [visible])

  return (
    <Layout title="Quotes" bottomNav onRefresh={load}>
      <div className="mb-3 flex gap-2">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search number, customer, staff…"
        />
        <button
          onClick={() => navigate('/quote')}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white active:bg-slate-700"
        >
          + New
        </button>
      </div>

      <Segmented className="mb-3" options={FILTERS} value={filter} onChange={setFilter} />

      {loading ? (
        <LoadingState />
      ) : loadFailed && rows.length === 0 ? (
        <ErrorState onRetry={load} />
      ) : visible.length === 0 ? (
        <EmptyState>
          {rows.length === 0
            ? 'No saved documents yet. Build one in the Quote tab and tap “Save”.'
            : 'Nothing matches your filter.'}
        </EmptyState>
      ) : (
        <>
          <p className="mb-2 px-1 text-xs text-slate-400">
            {visible.length} {visible.length === 1 ? 'document' : 'documents'} · {money(total)} total
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((r) => {
              const isSO = r.doc_type === 'SO'
              return (
                <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <button
                    onClick={() => navigate(`/quote?view=${r.id}`)}
                    className="-m-1 block w-full rounded-lg p-1 text-left active:bg-slate-50"
                  >
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
                      <p className="mt-1 truncate font-medium text-slate-800">{r.unit || r.customer_name || '—'}</p>
                      {r.unit && r.customer_name && (
                        <p className="truncate text-xs text-slate-500">{r.customer_name}</p>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold text-slate-900">{money(Number(r.total))}</span>
                  </div>

                  {isSO && r.source_id && numberById.has(r.source_id) && (
                    <p className="mt-1.5 text-xs text-slate-400">From quote {numberById.get(r.source_id)}</p>
                  )}
                  {r.categories && <p className="mt-1.5 truncate text-xs text-slate-500">{r.categories}</p>}
                  </button>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-400">
                      {r.prepared_by ? `By ${r.prepared_by} · ` : ''}
                      {relativeTime(r.created_at)}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => navigate(`/quote?view=${r.id}`)}
                        className="min-h-[36px] rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 active:bg-slate-50"
                      >
                        View
                      </button>
                      {(isAdmin || (!!userId && r.created_by === userId)) && (
                        <button
                          onClick={() => navigate(`/quote?edit=${r.id}`)}
                          className="min-h-[36px] rounded-lg border border-slate-400 px-3 text-xs font-medium text-slate-800 active:bg-slate-50"
                        >
                          Edit
                        </button>
                      )}
                      {!isSO && (
                        <button
                          onClick={() => navigate(`/quote?from=${r.id}&type=SO`)}
                          className="min-h-[36px] rounded-lg border border-emerald-600 px-3 text-xs font-medium text-emerald-700 active:bg-emerald-50"
                        >
                          → Convert to SO
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => remove(r)}
                          className="min-h-[36px] rounded-lg border border-red-200 px-3 text-xs font-medium text-red-600 active:bg-red-50"
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
