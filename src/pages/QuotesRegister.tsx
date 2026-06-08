import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Quotation } from '../lib/types'
import { Layout } from '../components/Layout'
import { relativeTime } from '../lib/format'

const money = (n: number) =>
  'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function QuotesRegister() {
  const [rows, setRows] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.number.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        r.prepared_by.toLowerCase().includes(q) ||
        r.categories.toLowerCase().includes(q),
    )
  }, [rows, query])

  const monthTotal = useMemo(
    () => visible.reduce((s, r) => s + Number(r.total || 0), 0),
    [visible],
  )

  return (
    <Layout title="Quotation Register" bottomNav>
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

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          {rows.length === 0
            ? 'No saved quotations yet. Build one in the Quote tab and tap “Save to Register”.'
            : 'No quotations match your search.'}
        </div>
      ) : (
        <>
          <p className="mb-2 px-1 text-xs text-slate-400">
            {visible.length} {visible.length === 1 ? 'quotation' : 'quotations'} · {money(monthTotal)} total
          </p>
          <ul className="space-y-3">
            {visible.map((r) => (
              <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-slate-900">{r.number}</p>
                    <p className="truncate font-medium text-slate-800">{r.customer_name || '—'}</p>
                  </div>
                  <span className="shrink-0 font-semibold text-slate-900">{money(Number(r.total))}</span>
                </div>
                {r.categories && (
                  <p className="mt-1.5 truncate text-xs text-slate-500">{r.categories}</p>
                )}
                <p className="mt-1.5 text-xs text-slate-400">
                  {r.prepared_by ? `By ${r.prepared_by} · ` : ''}
                  {relativeTime(r.created_at)}
                  {r.customer_phone ? ` · ${r.customer_phone}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Layout>
  )
}
