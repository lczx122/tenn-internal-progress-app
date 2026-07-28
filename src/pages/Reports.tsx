import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { realtimeChannel, coalesce } from '../lib/realtime'
import type { Claim, Job } from '../lib/types'
import { Layout } from '../components/Layout'
import { CATEGORIES } from '../lib/categories'
import { money } from '../lib/claims'
import { formatDate } from '../lib/format'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { progressStart, progressDone } from '../lib/progress'
import { canShareFiles, shareElementAsPdf } from '../lib/sharePdf'
import { usePersistedState } from '../lib/usePersistedState'
import { ErrorState } from '../components/ErrorState'

const ALL = '__all__'

// A printable balance report: for a chosen trade (or the whole unit), every unit's
// order amount, deposit collected up to a cut-off date, and remaining balance —
// matching the "BALANCE <TRADE> UP TO DATE <date>" sheets used on paper.
export default function Reports() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [soByUnit, setSoByUnit] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)

  const [cat, setCat] = usePersistedState<string>('tenn_reports_cat', 'Iron Work')
  const [project, setProject] = usePersistedState('tenn_reports_project', '')
  const [cutoff, setCutoff] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [outstandingOnly, setOutstandingOnly] = usePersistedState('tenn_reports_outstanding', false)
  const [includeArchived, setIncludeArchived] = usePersistedState('tenn_reports_archived', false)
  const [sharing, setSharing] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  // Mobile → share the report as a PDF (native share sheet); tablet/desktop → print.
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const on = () => setIsMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  async function load(quiet = false) {
    if (!quiet) progressStart()
    try {
      const [{ data: j, error: ej }, { data: c }, { data: q }] = await Promise.all([
        supabase.from('jobs').select('*').order('project'),
        supabase.from('claims').select('*'),
        supabase.from('quotations').select('number, unit_id').eq('doc_type', 'SO').not('unit_id', 'is', null),
      ])
      setLoadFailed(!!ej)
      if (!ej) {
        setJobs((j as Job[]) ?? [])
        setClaims((c as Claim[]) ?? [])
        const m = new Map<string, string>()
        for (const row of (q as { number: string; unit_id: string }[]) ?? []) {
          const prev = m.get(row.unit_id)
          m.set(row.unit_id, prev ? `${prev}, ${row.number}` : row.number)
        }
        setSoByUnit(m)
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
    const channel = realtimeChannel('reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'claims' }, rt.run)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quotations' }, rt.run)
      .subscribe()
    return () => {
      rt.cancel()
      supabase.removeChannel(channel)
    }
  }, [])
  useAutoRefresh(load)

  const projects = useMemo(
    () => [...new Set(jobs.map((j) => j.project).filter(Boolean))].sort() as string[],
    [jobs],
  )

  const rows = useMemo(() => {
    const cut = cutoff ? new Date(`${cutoff}T23:59:59`).getTime() : Infinity
    const claimsByJob = new Map<string, Claim[]>()
    for (const c of claims) {
      if (new Date(c.created_at).getTime() > cut) continue
      const arr = claimsByJob.get(c.job_id) ?? []
      arr.push(c)
      claimsByJob.set(c.job_id, arr)
    }
    return jobs
      .filter((j) => (includeArchived || !j.is_archived) && (!project || j.project === project))
      .map((j) => {
        const jc = claimsByJob.get(j.id) ?? []
        const amount = cat === ALL ? Number(j.order_total || 0) : Number(j.order_by_category?.[cat] || 0)
        const deposit =
          cat === ALL
            ? jc.reduce((s, c) => s + Number(c.amount || 0), 0)
            : jc
                .filter((c) => (c.work_category || '').trim() === cat)
                .reduce((s, c) => s + Number(c.amount || 0), 0)
        return { job: j, docNo: soByUnit.get(j.id) ?? '', amount, deposit, balance: amount - deposit }
      })
      .filter((r) => r.amount > 0.005 || r.deposit > 0.005)
      .filter((r) => !outstandingOnly || r.balance > 0.005)
      .sort((a, b) => a.docNo.localeCompare(b.docNo) || (a.job.unit_code || '').localeCompare(b.job.unit_code || ''))
  }, [jobs, claims, soByUnit, cat, project, cutoff, outstandingOnly, includeArchived])

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({ amount: t.amount + r.amount, deposit: t.deposit + r.deposit, balance: t.balance + r.balance }),
        { amount: 0, deposit: 0, balance: 0 },
      ),
    [rows],
  )

  const title = `BALANCE ${cat === ALL ? 'ALL TRADES' : cat.toUpperCase()} UP TO DATE ${formatDate(cutoff)}`

  function downloadCsv() {
    const head = ['No', 'Doc No', 'Debtor Name', 'Unit', 'Amount', 'Deposit', 'Balance']
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const lines = [
      head.map(esc).join(','),
      ...rows.map((r, i) =>
        [i + 1, r.docNo, `${r.job.customer_name} (${r.job.unit_code || ''})`, r.job.unit_code || '', r.amount, r.deposit, r.balance]
          .map(esc)
          .join(','),
      ),
      ['', '', '', 'TOTAL', totals.amount, totals.deposit, totals.balance].map(esc).join(','),
    ]
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^\w]+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const useShare = isMobile && canShareFiles()
  async function shareOrPrint() {
    if (!useShare || !reportRef.current) {
      window.print()
      return
    }
    setSharing(true)
    try {
      await shareElementAsPdf(reportRef.current, `${title.replace(/[^\w]+/g, '_')}.pdf`, 'l', {
        title,
        text: 'Balance report — Tenn Renovation',
      })
    } catch {
      window.print()
    } finally {
      setSharing(false)
    }
  }

  const field =
    'rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-slate-900'

  return (
    <Layout title="Reports" bottomNav wide onRefresh={load}>
      {/* Controls — hidden when printing */}
      <div className="no-print mb-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${field} font-medium`}>
            <option value={ALL}>All trades (unit total)</option>
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <select value={project} onChange={(e) => setProject(e.target.value)} className={field}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            Up to
            <input type="date" value={cutoff} onChange={(e) => setCutoff(e.target.value)} className={field} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={outstandingOnly} onChange={(e) => setOutstandingOnly(e.target.checked)} />
            Outstanding only
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-600">
            <input type="checkbox" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
            Include archived
          </label>
          <div className="ml-auto flex gap-2">
            <button onClick={downloadCsv} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 active:bg-slate-100">
              CSV
            </button>
            <button
              onClick={shareOrPrint}
              disabled={sharing}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white active:bg-slate-700 disabled:opacity-60"
            >
              {sharing ? 'Preparing…' : useShare ? 'Share PDF' : 'Print / PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* The report itself — the only thing that prints */}
      <div ref={reportRef} className="report-print">
        <h1 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-900">{title}</h1>
        {loading ? (
          <p className="py-10 text-center text-slate-400">Loading…</p>
        ) : loadFailed && jobs.length === 0 ? (
          <ErrorState onRetry={load} />
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-slate-400">
            No units with {cat === ALL ? 'an order' : cat} in this selection.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="report-table w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  <th className="border border-slate-300 px-2 py-1.5 text-left">No</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left">Doc No</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left">Debtor Name</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left">Unit</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Amount</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Deposit</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Balance</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-left">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.job.id} className="text-slate-800">
                    <td className="border border-slate-300 px-2 py-1 text-slate-500">{i + 1}</td>
                    <td className="whitespace-nowrap border border-slate-300 px-2 py-1">{r.docNo || '—'}</td>
                    <td className="border border-slate-300 px-2 py-1">
                      {r.job.customer_name}
                      {r.job.unit_code ? ` (${r.job.unit_code})` : ''}
                    </td>
                    <td className="whitespace-nowrap border border-slate-300 px-2 py-1">{r.job.unit_code || '—'}</td>
                    <td className="whitespace-nowrap border border-slate-300 px-2 py-1 text-right tabular-nums">{money(r.amount)}</td>
                    <td className="whitespace-nowrap border border-slate-300 px-2 py-1 text-right tabular-nums">{money(r.deposit)}</td>
                    <td className="whitespace-nowrap border border-slate-300 px-2 py-1 text-right font-semibold tabular-nums">{money(r.balance)}</td>
                    <td className="border border-slate-300 px-2 py-1" />
                  </tr>
                ))}
                <tr className="report-total bg-slate-100 font-semibold text-slate-900">
                  <td className="border border-slate-300 px-2 py-1.5" colSpan={4}>
                    TOTAL · {rows.length} unit{rows.length === 1 ? '' : 's'}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{money(totals.amount)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{money(totals.deposit)}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-right tabular-nums">{money(totals.balance)}</td>
                  <td className="border border-slate-300 px-2 py-1.5" />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
