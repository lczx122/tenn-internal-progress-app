import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/Layout'
import { postAnnouncement } from '../lib/push'

type Pay = { bank_name?: string; account_name?: string; account_number?: string; note?: string }
type Announcement = { id?: string; text?: string; by?: string }

export default function AdminSettings() {
  const { isAdmin, isBoss } = useAuth()
  const [pay, setPay] = useState<Pay>({})
  const [paySaved, setPaySaved] = useState(false)
  const [payBusy, setPayBusy] = useState(false)

  const [ann, setAnn] = useState<Announcement>({})
  const [draft, setDraft] = useState('')
  const [annBusy, setAnnBusy] = useState(false)
  const [annMsg, setAnnMsg] = useState('')

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['payment_details', 'announcement'])
      .then(({ data }) => {
        for (const row of data ?? []) {
          if (row.key === 'payment_details') setPay((row.value as Pay) ?? {})
          if (row.key === 'announcement') setAnn((row.value as Announcement) ?? {})
        }
      })
  }, [])

  async function savePay() {
    setPayBusy(true)
    setPaySaved(false)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'payment_details', value: pay, updated_at: new Date().toISOString() })
    setPayBusy(false)
    if (!error) {
      setPaySaved(true)
      setTimeout(() => setPaySaved(false), 2000)
    } else {
      alert('Could not save: ' + error.message)
    }
  }

  async function post() {
    const text = draft.trim()
    if (!text) return
    setAnnBusy(true)
    setAnnMsg('')
    const r = await postAnnouncement(text)
    setAnnBusy(false)
    if (r.ok) {
      setAnn({ text, by: 'you' })
      setDraft('')
      setAnnMsg(`Posted ✓ — banner is live${typeof r.sent === 'number' ? ` · ${r.sent} push${r.sent === 1 ? '' : 'es'} sent` : ''}.`)
    } else {
      setAnnMsg('Could not post: ' + (r.error ?? 'unknown error'))
    }
  }

  async function clearAnn() {
    setAnnBusy(true)
    await supabase
      .from('app_settings')
      .upsert({ key: 'announcement', value: {}, updated_at: new Date().toISOString() })
    setAnn({})
    setAnnBusy(false)
    setAnnMsg('Cleared.')
  }

  if (!isAdmin) {
    return (
      <Layout title="Settings" back={<BackLink />}>
        <p className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          Admins only.
        </p>
      </Layout>
    )
  }

  const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900'
  const label = 'mb-1 block text-xs font-medium text-slate-500'

  return (
    <Layout title="Settings" back={<BackLink />}>
      {/* Payment details (admin) */}
      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">💳 Payment details</h2>
        <p className="mb-3 text-xs text-slate-500">
          Shown to staff via the mobile payment button. Put your QR image at <code>public/payment-qr.png</code>.
        </p>
        <div className="space-y-3">
          <div>
            <label className={label}>Bank</label>
            <input className={field} value={pay.bank_name ?? ''} onChange={(e) => setPay({ ...pay, bank_name: e.target.value })} placeholder="e.g. Maybank" />
          </div>
          <div>
            <label className={label}>Account name</label>
            <input className={field} value={pay.account_name ?? ''} onChange={(e) => setPay({ ...pay, account_name: e.target.value })} placeholder="Account holder" />
          </div>
          <div>
            <label className={label}>Account number</label>
            <input className={field} value={pay.account_number ?? ''} onChange={(e) => setPay({ ...pay, account_number: e.target.value })} placeholder="e.g. 5123 4567 8901" />
          </div>
          <div>
            <label className={label}>Note (optional)</label>
            <input className={field} value={pay.note ?? ''} onChange={(e) => setPay({ ...pay, note: e.target.value })} placeholder="e.g. Reference: unit code" />
          </div>
          <button
            onClick={savePay}
            disabled={payBusy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white active:bg-slate-700 disabled:opacity-50"
          >
            {paySaved ? 'Saved ✓' : payBusy ? 'Saving…' : 'Save payment details'}
          </button>
        </div>
      </section>

      {/* Announcement composer (boss only) */}
      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">📢 Announcement</h2>
        {isBoss ? (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Pins a banner below the header for everyone and pushes a notification to staff who have
              notifications on. Posting a new one replaces the current.
            </p>
            {ann.text && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <span className="font-medium">Live now:</span> {ann.text}
              </div>
            )}
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder="Type an announcement for the whole team…"
              className={field}
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={post}
                disabled={annBusy || !draft.trim()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white active:bg-amber-700 disabled:opacity-50"
              >
                {annBusy ? 'Posting…' : 'Post announcement'}
              </button>
              {ann.text && (
                <button
                  onClick={clearAnn}
                  disabled={annBusy}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 active:bg-slate-50 disabled:opacity-50"
                >
                  Clear current
                </button>
              )}
            </div>
            {annMsg && <p className="mt-2 text-xs text-slate-500">{annMsg}</p>}
          </>
        ) : (
          <p className="text-xs text-slate-400">Only the boss can post announcements.</p>
        )}
      </section>
    </Layout>
  )
}

function BackLink() {
  return (
    <Link to="/staff" className="text-xl leading-none text-slate-300">
      ←
    </Link>
  )
}
