import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { realtimeChannel, coalesce } from '../lib/realtime'
import { useAuth } from '../contexts/AuthContext'
import type { Claim, Job } from '../lib/types'
import { Layout } from '../components/Layout'
import { LoadingState, EmptyState , SearchInput , Segmented } from '../components/ui'
import { CLAIM_CATEGORIES } from '../lib/units'
import { CATEGORIES } from '../lib/categories'
import { money0, sumByCategory, perTradeRows, UNALLOCATED } from '../lib/claims'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { FinanceToggle } from '../components/FinanceToggle'
import { cacheGet, cacheSet } from '../lib/pageCache'
import { progressStart, progressDone } from '../lib/progress'
import { usePersistedState, oneOf } from '../lib/usePersistedState'
import { ErrorState } from '../components/ErrorState'
import { RecordCollectionSheet } from '../components/RecordCollectionSheet'

export default function Claims() {
  const c0 = cacheGet<{ jobs: Job[]; claims: Claim[] }>('collection')
  const [jobs, setJobs] = useState<Job[]>(c0?.jobs ?? [])
  const [claims, setClaims] = useState<Claim[]>(c0?.claims ?? [])
  const [loading, setLoading] = useState(!c0)
  const [loadFailed, setLoadFailed] = useState(false)
  const [recording, setRecording] = useState(false)
  const [query, setQuery] = useState('')
  const [project, setProject] = usePersistedState('tenn_claims_project', '')
  const [scope, setScope] = usePersistedState<'mine' | 'all' | null>('tenn_claims_scope', null, {
    validate: oneOf('mine', 'all'),
  })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { isAdmin, staffPic } = useAuth()
  // Default to the signed-in staffer's own collection (if their PIC is set);
  // admins (and anyone without a PIC) default to everything.
  const effectiveScope: 'mine' | 'all' = scope ?? (!isAdmin && staffPic ? 'mine' : 'all')
  const navigate = useNavigate()

  async function load(quiet = false) {
    if (!quiet) progressStart()
    try {
      const [{ data: j, error: ej }, { data: c }] = await Promise.all([
        supabase.from('jobs').select('*').eq('is_archived', false).order('project'),
        supabase.from('claims').select('*'),
      ])
      setLoadFailed(!!ej)
      if (!ej) {
        const nj = (j as Job[]) ?? []
        const ncl = (c as Claim[]) ?? []
        setJobs(nj)
        setClaims(ncl)
        cacheSet('collection', { jobs: nj, claims: ncl })
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
    const channel = realtimeChannel('claims-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, rt.run)
      .subscribe()
    return () => {
      rt.cancel()
      supabase.removeChannel(channel)
    }
  }, [])

  useAutoRefresh(load)

  // Group claims by unit.
  const claimsByJob = useMemo(() => {
    const m = new Map<string, Claim[]>()
    for (const c of claims) {
      const arr = m.get(c.job_id) ?? []
      arr.push(c)
      m.set(c.job_id, arr)
    }
    return m
  }, [claims])

  // One row per unit that has an order total or any collection (after search).
  const baseRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return jobs
      .filter(
        (j) =>
          effectiveScope === 'all' || !staffPic || j.pics?.includes(staffPic) || j.pic === staffPic,
      )
      .map((j) => {
        const list = claimsByJob.get(j.id) ?? []
        const byCat = sumByCategory(list)
        const collected = CLAIM_CATEGORIES.reduce((s, c) => s + byCat[c], 0)
        const order = Number(j.order_total || 0)
        return { job: j, collected, order, balance: order - collected }
      })
      .filter((r) => r.order > 0 || r.collected > 0)
      .filter(
        (r) =>
          !q ||
          r.job.customer_name.toLowerCase().includes(q) ||
          r.job.unit_code.toLowerCase().includes(q) ||
          r.job.project.toLowerCase().includes(q),
      )
  }, [jobs, claimsByJob, query, effectiveScope, staffPic])

  // One spreadsheet per project, switchable with chips.
  const projects = useMemo(() => {
    const set = new Set<string>()
    for (const r of baseRows) set.add(r.job.project || '—')
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [baseRows])
  const activeProject = projects.includes(project) ? project : projects[0] ?? ''

  const rows = useMemo(
    () =>
      baseRows
        .filter((r) => (r.job.project || '—') === activeProject)
        .sort((a, b) => a.job.customer_name.localeCompare(b.job.customer_name)),
    [baseRows, activeProject],
  )

  // Totals for the active project.
  const totals = useMemo(() => {
    let order = 0
    let collected = 0
    for (const r of rows) {
      order += r.order
      collected += r.collected
    }
    return { order, collected, balance: order - collected }
  }, [rows])

  // Collected & balance per work category, summed across the visible units —
  // order from each unit's order_by_category, collected from tagged claims.
  const tradeAgg = useMemo(() => {
    const order: Record<string, number> = {}
    const collected: Record<string, number> = {}
    for (const r of rows) {
      for (const [k, v] of Object.entries(r.job.order_by_category ?? {})) order[k] = (order[k] ?? 0) + Number(v || 0)
      for (const c of claimsByJob.get(r.job.id) ?? []) {
        const k = (c.work_category && String(c.work_category).trim()) || UNALLOCATED
        collected[k] = (collected[k] ?? 0) + Number(c.amount || 0)
      }
    }
    const cats = new Set<string>([...Object.keys(order), ...Object.keys(collected)])
    cats.delete(UNALLOCATED)
    const ordered = CATEGORIES.map((c) => c.key).filter((k) => cats.has(k))
    for (const k of cats) if (!ordered.includes(k)) ordered.push(k)
    const out = ordered.map((k) => ({ cat: k, order: order[k] ?? 0, collected: collected[k] ?? 0, balance: (order[k] ?? 0) - (collected[k] ?? 0) }))
    if (collected[UNALLOCATED]) out.push({ cat: UNALLOCATED, order: 0, collected: collected[UNALLOCATED], balance: 0 })
    return out
  }, [rows, claimsByJob])
  const hasTradeData = tradeAgg.some((r) => r.cat !== UNALLOCATED)

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pct = (collected: number, order: number) =>
    order > 0 ? Math.round((collected / order) * 100) + '%' : '—'

  const num = 'px-1.5 py-2 text-right tabular-nums whitespace-nowrap overflow-hidden'
  const head = 'px-1.5 py-2 text-right text-xs font-semibold text-slate-500 whitespace-nowrap'

  return (
    <Layout title="Money" bottomNav wide onRefresh={load}>
      <FinanceToggle current="collection" />

      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setRecording(true)}
          className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white active:bg-emerald-700"
        >
          + Record collection
        </button>
        <button
          onClick={() => navigate('/reports')}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 active:bg-slate-100"
        >
          Balance report ›
        </button>
      </div>

      {recording && <RecordCollectionSheet jobs={jobs} onClose={() => setRecording(false)} onSaved={load} />}

      {staffPic && (
        <Segmented
          className="mb-3"
          options={[
            { key: 'mine', label: 'My collection' },
            { key: 'all', label: 'All collections' },
          ]}
          value={effectiveScope}
          onChange={setScope}
        />
      )}

      <div className="mb-3">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search unit, customer, project…"
          className="w-full"
        />
      </div>

      {/* Project chips — one spreadsheet per project */}
      {projects.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {projects.map((p) => (
            <button
              key={p}
              onClick={() => setProject(p)}
              className={
                'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium ' +
                (p === activeProject
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-600 active:bg-slate-50')
              }
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Summary tiles for the active project */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Tile label="Total order value" value={money0(totals.order)} />
        <Tile label="Collected" value={money0(totals.collected)} accent="text-emerald-600" />
        <Tile
          label="Outstanding"
          value={money0(totals.balance)}
          accent={totals.balance > 0 ? 'text-amber-600' : 'text-slate-900'}
        />
      </div>

      {/* Collected & balance per work category, across the active project + scope */}
      {hasTradeData && (
        <div className="mb-4 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">Collected by trade</div>
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500">Trade</th>
                <th className={head + ' w-[84px]'}>Order</th>
                <th className={head + ' w-[84px]'}>Collect</th>
                <th className={head + ' w-[84px]'}>Bal.</th>
              </tr>
            </thead>
            <tbody>
              {tradeAgg.map((t) => (
                <tr key={t.cat} className="border-b border-slate-100 last:border-0">
                  <td className="truncate px-2 py-2 font-medium text-slate-700">{t.cat}</td>
                  <td className={num + ' text-slate-600'}>{t.order ? money0(t.order) : '—'}</td>
                  <td className={num + ' font-semibold text-emerald-700'}>{money0(t.collected)}</td>
                  <td className={num + (t.cat === UNALLOCATED ? ' text-slate-400' : t.balance > 0 ? ' font-semibold text-amber-700' : ' text-slate-400')}>
                    {t.cat === UNALLOCATED ? '—' : money0(t.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : loadFailed && jobs.length === 0 ? (
        <ErrorState onRetry={load} />
      ) : rows.length === 0 ? (
        <EmptyState>
          No collections yet. Open a unit and set its order total to start tracking collections.
        </EmptyState>
      ) : (
        <div className="rounded-xl bg-white shadow-sm">
          <table className="w-full table-fixed text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2 text-left text-xs font-semibold text-slate-500">Unit</th>
                <th className={head + ' w-[80px]'}>Order</th>
                <th className={head + ' w-[80px]'}>Collect</th>
                <th className={head + ' w-[36px]'}>%</th>
                <th className={head + ' w-[80px]'}>Bal.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isOpen = expanded.has(r.job.id)
                const trades = perTradeRows(r.job, claimsByJob.get(r.job.id) ?? [])
                return (
                  <Fragment key={r.job.id}>
                    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-2 py-2">
                        <div className="flex items-start gap-1.5">
                          <button
                            onClick={() => toggleExpand(r.job.id)}
                            className="mt-0.5 shrink-0 text-slate-400 active:text-slate-700"
                            title={isOpen ? 'Hide trades' : 'Show trades'}
                          >
                            <span className={'inline-block transition-transform ' + (isOpen ? 'rotate-90' : '')}>▸</span>
                          </button>
                          <div className="min-w-0 cursor-pointer" onClick={() => navigate(`/job/${r.job.id}`)}>
                            <div className="truncate font-medium text-slate-800">
                              {r.job.customer_name || r.job.unit_code || '—'}
                            </div>
                            {r.job.unit_code && <div className="truncate text-[11px] text-slate-400">{r.job.unit_code}</div>}
                          </div>
                        </div>
                      </td>
                      <td className={num + ' text-slate-700'}>{r.order ? money0(r.order) : '—'}</td>
                      <td className={num + ' font-semibold text-emerald-700'}>{money0(r.collected)}</td>
                      <td className={num + ' text-slate-500'}>{pct(r.collected, r.order)}</td>
                      <td className={num + (r.balance > 0 ? ' font-semibold text-amber-700' : ' text-slate-400')}>
                        {money0(r.balance)}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={5} className="px-2 py-1.5">
                          {trades.length === 0 ? (
                            <p className="py-1 text-[11px] text-slate-400">
                              No per-trade breakdown yet — set order amounts by trade on the unit.
                            </p>
                          ) : (
                            <table className="w-full table-fixed">
                              <tbody>
                                {trades.map((t) => (
                                  <tr key={t.cat} className="text-[11px]">
                                    <td className="truncate py-0.5 pl-5 pr-2 text-slate-500">{t.cat}</td>
                                    <td className={num + ' w-[84px] text-slate-500'}>{t.order ? money0(t.order) : '—'}</td>
                                    <td className={num + ' w-[84px] text-emerald-700'}>{money0(t.collected)}</td>
                                    <td className={num + ' w-[84px] ' + (t.cat === UNALLOCATED ? 'text-slate-400' : t.balance > 0 ? 'text-amber-700' : 'text-slate-400')}>
                                      {t.cat === UNALLOCATED ? '—' : money0(t.balance)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                <td className="px-2 py-2 text-left text-slate-700">Total ({rows.length})</td>
                <td className={num + ' text-slate-800'}>{money0(totals.order)}</td>
                <td className={num + ' text-emerald-700'}>{money0(totals.collected)}</td>
                <td className={num + ' text-slate-600'}>{pct(totals.collected, totals.order)}</td>
                <td className={num + ' text-amber-700'}>{money0(totals.balance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Layout>
  )
}

function Tile({ label, value, accent = 'text-slate-900' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className={`text-base font-bold leading-tight sm:text-xl ${accent}`}>{value}</div>
      <div className="mt-1 text-[11px] font-medium text-slate-500">{label}</div>
    </div>
  )
}
