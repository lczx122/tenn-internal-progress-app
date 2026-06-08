import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/Layout'

export default function NewJob() {
  const { displayName, session } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    customer_name: '',
    address: '',
    phone: '',
    key_holder: 'Office',
    start_date: '',
    target_date: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.customer_name.trim()) {
      setError('Customer name is required.')
      return
    }
    setBusy(true)
    setError(null)

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        customer_name: form.customer_name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim(),
        key_holder: form.key_holder.trim() || 'Office',
        start_date: form.start_date || null,
        target_date: form.target_date || null,
        updated_by: displayName,
      })
      .select()
      .single()

    if (error || !data) {
      setError(error?.message ?? 'Could not create job.')
      setBusy(false)
      return
    }

    // Seed the timeline with a "created" event.
    await supabase.from('job_events').insert({
      job_id: data.id,
      type: 'created',
      body: `Job created`,
      author_id: session?.user.id ?? null,
      author_name: displayName,
    })

    navigate(`/job/${data.id}`, { replace: true })
  }

  const field =
    'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-slate-900'
  const labelCls = 'mb-1 block text-sm font-medium text-slate-700'

  return (
    <Layout
      title="New Unit"
      back={
        <Link to="/units" className="text-xl leading-none text-slate-300">
          ←
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
          <div>
            <label className={labelCls}>Unit code *</label>
            <input
              className={field}
              value={form.customer_name}
              onChange={(e) => set('customer_name', e.target.value)}
              placeholder="e.g. A-10-06"
            />
          </div>
          <div>
            <label className={labelCls}>Room type / description</label>
            <input
              className={field}
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="e.g. 2 Room Standard"
            />
          </div>
          <div>
            <label className={labelCls}>Contact phone</label>
            <input
              type="tel"
              className={field}
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Who has the keys?</label>
            <input
              className={field}
              value={form.key_holder}
              onChange={(e) => set('key_holder', e.target.value)}
              placeholder="e.g. Office, Ahmad, Customer"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Start date</label>
              <input
                type="date"
                className={field}
                value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className={labelCls}>Target completion</label>
              <input
                type="date"
                className={field}
                value={form.target_date}
                onChange={(e) => set('target_date', e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-slate-900 py-3 font-medium text-white active:bg-slate-700 disabled:opacity-60"
        >
          {busy ? 'Creating…' : 'Create job'}
        </button>
      </form>
    </Layout>
  )
}
