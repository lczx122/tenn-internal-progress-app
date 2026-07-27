import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Costing, Job, JobWork } from '../lib/types'
import { Layout } from '../components/Layout'
import { PercentBar } from '../components/StageBar'
import { overallPercent } from '../lib/stages'
import { calcCosting, money, num, progressToStatus, statusStyle, COSTING_CATEGORIES, COSTING_STATUSES, templateFor } from '../lib/costing'
import { runDb } from '../lib/toast'
import { confirmDialog } from '../lib/dialog'

type CostRow = { label: string; amount: string }
type CommRow = { name: string; kind: 'fixed' | 'pct'; value: string }
type ShareRow = { name: string; percent: string }

export default function CostingForm() {
  const { id } = useParams<{ id: string }>()
  const { session, isBoss } = useAuth()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [loading, setLoading] = useState(isEdit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [people, setPeople] = useState<string[]>([])

  const [cashSaleNo, setCashSaleNo] = useState('')
  const [category, setCategory] = useState<string>(COSTING_CATEGORIES[0].key)
  const [jobId, setJobId] = useState('')
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobPct, setJobPct] = useState<Map<string, number>>(new Map())
  const [customer, setCustomer] = useState('')
  const [date, setDate] = useState('')
  const [status, setStatus] = useState('In Progress')
  const [revenue, setRevenue] = useState('')
  const [costs, setCosts] = useState<CostRow[]>(
    templateFor(COSTING_CATEGORIES[0].key).map((l) => ({ label: l, amount: '' })),
  )
  const [commissions, setCommissions] = useState<CommRow[]>([])
  const [shares, setShares] = useState<ShareRow[]>([{ name: '', percent: '50' }])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name')
      .order('full_name')
      .then(({ data }) => setPeople(((data as { full_name: string }[]) ?? []).map((p) => p.full_name)))
  }, [])

  // Units (work cards) available to link, with their live overall progress.
  useEffect(() => {
    Promise.all([
      supabase.from('jobs').select('*').eq('is_archived', false).order('customer_name'),
      supabase.from('job_works').select('job_id,stage'),
    ]).then(([{ data: j }, { data: w }]) => {
      setJobs((j as Job[]) ?? [])
      const stagesByJob = new Map<string, string[]>()
      for (const x of (w as Pick<JobWork, 'job_id' | 'stage'>[]) ?? []) {
        const arr = stagesByJob.get(x.job_id) ?? []
        arr.push(x.stage)
        stagesByJob.set(x.job_id, arr)
      }
      const pct = new Map<string, number>()
      for (const [id, st] of stagesByJob) pct.set(id, overallPercent(st))
      setJobPct(pct)
    })
  }, [])

  useEffect(() => {
    if (!isEdit || !isBoss) return
    supabase
      .from('costings')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        const c = data as Costing | null
        if (c) {
          setCashSaleNo(c.cash_sale_no)
          setCategory(c.category || COSTING_CATEGORIES[0].key)
          setJobId(c.job_id ?? '')
          setCustomer(c.customer)
          setDate(c.costing_date ?? '')
          setStatus(c.status || 'In Progress')
          setRevenue(String(c.revenue ?? ''))
          setCosts((c.costs ?? []).map((x) => ({ label: x.label, amount: String(x.amount) })))
          setCommissions((c.commissions ?? []).map((x) => ({ name: x.name, kind: x.kind === 'pct' ? 'pct' : 'fixed', value: String(x.value) })))
          setShares((c.shares ?? []).map((x) => ({ name: x.name, percent: String(x.percent) })))
          setNotes(c.notes)
        }
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isBoss])

  const calc = calcCosting({ revenue, costs, commissions, shares })

  // When linked to a unit, progress/status come from that unit's work cards.
  const linkedPercent = jobId ? jobPct.get(jobId) ?? 0 : null
  const derivedStatus = linkedPercent !== null ? progressToStatus(linkedPercent) : null
  const linkedJob = jobs.find((j) => j.id === jobId)

  // Switching category (on a fresh costing) loads that category's cost columns.
  function changeCategory(key: string) {
    setCategory(key)
    if (!isEdit && costs.every((c) => !c.amount.trim())) {
      setCosts(templateFor(key).map((l) => ({ label: l, amount: '' })))
    }
  }

  function linkJob(id: string) {
    setJobId(id)
    const j = jobs.find((x) => x.id === id)
    if (j && !customer.trim()) setCustomer(j.customer_name)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const row = {
      cash_sale_no: cashSaleNo.trim(),
      category,
      job_id: jobId || null,
      customer: customer.trim(),
      costing_date: date || null,
      revenue: num(revenue),
      costs: costs.filter((c) => c.label.trim() || c.amount).map((c) => ({ label: c.label.trim(), amount: num(c.amount) })),
      commissions: commissions.filter((c) => c.name.trim() || c.value).map((c) => ({ name: c.name.trim(), kind: c.kind, value: num(c.value) })),
      shares: shares.filter((c) => c.name.trim() || c.percent).map((c) => ({ name: c.name.trim(), percent: num(c.percent) })),
      notes: notes.trim(),
      // A linked costing stores the unit-derived status so list/exports stay
      // consistent; the list also recomputes it live from the unit.
      status: derivedStatus ?? status,
    }
    const res = isEdit
      ? await supabase.from('costings').update(row).eq('id', id)
      : await supabase.from('costings').insert({ ...row, created_by: session?.user.id ?? null })
    if (res.error) {
      setError(res.error.message)
      setBusy(false)
      return
    }
    navigate('/costing')
  }

  async function remove() {
    if (!id) return
    if (
      !(await confirmDialog({
        title: 'Delete costing',
        message: 'Delete this costing? This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return
    setBusy(true)
    const ok = await runDb(supabase.from('costings').delete().eq('id', id), {
      ok: 'Costing deleted',
      fail: 'Could not delete',
    })
    setBusy(false)
    if (ok) navigate('/costing')
  }

  const field =
    'block w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-slate-900'
  // Row inputs sit in flex rows — no w-full (it fights flex-1 and collapses them).
  const rowField =
    'min-w-0 rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-slate-900'
  const labelCls = 'mb-1 block text-sm font-medium text-slate-700'

  if (!isBoss) {
    return (
      <Layout title="Costing" back={<BackLink />}>
        <p className="py-10 text-center text-slate-400">Boss only.</p>
      </Layout>
    )
  }
  if (loading) {
    return (
      <Layout title="Costing" back={<BackLink />}>
        <p className="py-10 text-center text-slate-400">Loading…</p>
      </Layout>
    )
  }

  return (
    <Layout title={isEdit ? 'Edit costing' : 'New costing'} back={<BackLink />}>
      <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-4">
        {/* Sale */}
        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cash sale no.</label>
              <input className={field} value={cashSaleNo} onChange={(e) => setCashSaleNo(e.target.value)} placeholder="e.g. CS2605/012" />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={field} value={category} onChange={(e) => changeCategory(e.target.value)}>
                {COSTING_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Unit / customer / item</label>
            <input className={field} value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="e.g. A-10-06 — 2 Room Standard" />
          </div>
          <div>
            <label className={labelCls}>Linked unit (optional)</label>
            <select className={field} value={jobId} onChange={(e) => linkJob(e.target.value)}>
              <option value="">— Not linked —</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.customer_name}
                  {j.project ? ` · ${j.project}` : ''}
                </option>
              ))}
            </select>
            {linkedJob && (
              <div className="mt-2 rounded-lg bg-slate-50 p-3">
                <PercentBar percent={linkedPercent ?? 0} label="Unit progress" />
                <p className="mt-2 text-xs text-slate-500">
                  Status follows this unit —{' '}
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${statusStyle(derivedStatus ?? '')}`}>{derivedStatus}</span>. Update the unit's work cards to change it.{' '}
                  <Link to={`/job/${jobId}`} className="font-medium text-slate-600 underline">Open unit →</Link>
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Selling price (RM)</label>
              <input type="number" step="0.01" min="0" className={field} value={revenue} onChange={(e) => setRevenue(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Direct costs */}
        <Section title="Costs (material, supplier, bank…)" total={money(calc.directCost)}>
          {costs.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input className={rowField + ' flex-1'} placeholder="Label" value={c.label} onChange={(e) => setCosts(upd(costs, i, { label: e.target.value }))} />
              <input type="number" step="0.01" className={rowField + ' w-28'} placeholder="RM" value={c.amount} onChange={(e) => setCosts(upd(costs, i, { amount: e.target.value }))} />
              <RemoveBtn onClick={() => setCosts(costs.filter((_, j) => j !== i))} />
            </div>
          ))}
          <AddBtn label="+ Add cost" onClick={() => setCosts([...costs, { label: '', amount: '' }])} />
        </Section>

        {/* Commissions (a cost) */}
        <Section title="Commissions (counted as cost)" total={money(calc.totalCommission)}>
          {commissions.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={rowField + ' flex-1'} list="people" placeholder="Name" value={c.name} onChange={(e) => setCommissions(upd(commissions, i, { name: e.target.value }))} />
              <select className={rowField + ' w-24'} value={c.kind} onChange={(e) => setCommissions(upd(commissions, i, { kind: e.target.value as 'fixed' | 'pct' }))}>
                <option value="fixed">RM</option>
                <option value="pct">% sale</option>
              </select>
              <input type="number" step="0.01" className={rowField + ' w-20'} placeholder={c.kind === 'pct' ? '%' : 'RM'} value={c.value} onChange={(e) => setCommissions(upd(commissions, i, { value: e.target.value }))} />
              <span className="w-24 shrink-0 text-right text-sm font-medium text-slate-700">{money(calc.commissionAmounts[i] ?? 0)}</span>
              <RemoveBtn onClick={() => setCommissions(commissions.filter((_, j) => j !== i))} />
            </div>
          ))}
          <AddBtn label="+ Add commission" onClick={() => setCommissions([...commissions, { name: '', kind: 'fixed', value: '' }])} />
        </Section>

        <Figure label="Total costing" value={calc.totalCost} />
        <Figure label="Gross profit (selling − costing)" value={calc.grossProfit} strong sub={`Margin ${calc.margin.toFixed(2)}%`} />

        {/* Profit sharing */}
        <Section title="Profit sharing (% of gross profit)" total={money(calc.totalShared)}>
          {shares.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={rowField + ' flex-1'} list="people" placeholder="Partner name" value={c.name} onChange={(e) => setShares(upd(shares, i, { name: e.target.value }))} />
              <div className="flex items-center gap-1">
                <input type="number" step="0.1" className={rowField + ' w-20'} placeholder="%" value={c.percent} onChange={(e) => setShares(upd(shares, i, { percent: e.target.value }))} />
                <span className="text-slate-400">%</span>
              </div>
              <span className="w-24 shrink-0 text-right text-sm font-medium text-slate-700">{money(calc.shareAmounts[i] ?? 0)}</span>
              <RemoveBtn onClick={() => setShares(shares.filter((_, j) => j !== i))} />
            </div>
          ))}
          <AddBtn label="+ Add partner" onClick={() => setShares([...shares, { name: '', percent: '' }])} />
        </Section>

        <Figure label="Unallocated / retained" value={calc.unallocated} />

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <label className={labelCls}>Status</label>
          {linkedJob ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyle(derivedStatus ?? '')}`}>{derivedStatus}</span>
              <span className="text-slate-500">{linkedPercent ?? 0}% · synced from linked unit</span>
            </div>
          ) : (
            <select className={field} value={status} onChange={(e) => setStatus(e.target.value)}>
              {COSTING_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <label className={labelCls + ' mt-3'}>Notes</label>
          <textarea className={field} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button type="submit" disabled={busy} className="w-full rounded-lg bg-slate-900 py-3 font-medium text-white active:bg-slate-700 disabled:opacity-60">
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create costing'}
        </button>
      </form>

      {isEdit && (
        <button onClick={remove} disabled={busy} className="mx-auto my-5 block w-full max-w-3xl rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-600 active:bg-red-50 disabled:opacity-60">
          Delete costing
        </button>
      )}

      <datalist id="people">
        {people.map((p) => (
          <option key={p} value={p} />
        ))}
      </datalist>
    </Layout>
  )
}

function upd<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((x, j) => (j === i ? { ...x, ...patch } : x))
}

function Section({ title, total, children }: { title: string; total: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        <span className="text-sm font-semibold text-slate-900">{total}</span>
      </div>
      {children}
    </section>
  )
}

function Figure({ label, value, strong, sub }: { label: string; value: number; strong?: boolean; sub?: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
      <span className="text-sm">{label}{sub && <span className="ml-2 text-xs text-slate-400">{sub}</span>}</span>
      <span className={(strong ? 'text-lg font-bold ' : 'font-medium ') + (value < 0 ? 'text-rose-300' : '')}>{money(value)}</span>
    </div>
  )
}

function AddBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-medium text-slate-500 active:text-slate-800">{label}</button>
  )
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 rounded-lg bg-rose-50 px-2 text-rose-500 active:bg-rose-100" title="Remove">✕</button>
  )
}

function BackLink() {
  return (
    <Link to="/costing" className="text-xl leading-none text-slate-300">←</Link>
  )
}
