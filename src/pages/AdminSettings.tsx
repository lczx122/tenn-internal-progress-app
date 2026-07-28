import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Layout } from '../components/Layout'
import { BackLink } from '../components/BackLink'
import { Icon } from '../components/Icon'
import { NotificationSettings } from '../components/NotificationSettings'
import { postAnnouncement } from '../lib/push'
import { getTheme, setTheme, type Theme } from '../lib/theme'
import { toastErr } from '../lib/toast'

type Pay = { bank_name?: string; account_name?: string; account_number?: string; note?: string }
type Announcement = { id?: string; text?: string; by?: string }

// The app-wide Settings hub. Everyone gets Account + Notifications; admins also
// get Management links + Payment details; the boss also gets the Announcement
// composer. (Reached by tapping your name in the header / sidebar.)
export default function AdminSettings() {
  const { isAdmin, isBoss, displayName, signOut } = useAuth()
  const [pay, setPay] = useState<Pay>({})
  const [paySaved, setPaySaved] = useState(false)
  const [payBusy, setPayBusy] = useState(false)

  const [theme, setThemeState] = useState<Theme>(getTheme())
  function pickTheme(t: Theme) {
    setThemeState(t)
    setTheme(t)
  }

  const [ann, setAnn] = useState<Announcement>({})
  const [draft, setDraft] = useState('')
  const [annBusy, setAnnBusy] = useState(false)
  const [annMsg, setAnnMsg] = useState('')

  useEffect(() => {
    if (!isAdmin) return
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
  }, [isAdmin])

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
      toastErr('Could not save — ' + error.message)
    }
  }

  async function post() {
    const text = draft.trim()
    if (!text) return
    setAnnBusy(true)
    setAnnMsg('')
    const r = await postAnnouncement(text, displayName)
    setAnnBusy(false)
    if (r.ok) {
      setAnn({ text, by: displayName })
      setDraft('')
      const push =
        typeof r.pushed === 'number'
          ? ` · ${r.pushed} push${r.pushed === 1 ? '' : 'es'} sent`
          : ' · push not set up yet'
      setAnnMsg('Posted ✓ — banner is live' + push + '.')
    } else {
      setAnnMsg('Could not post: ' + (r.error ?? 'unknown error'))
    }
  }

  async function clearAnn() {
    setAnnBusy(true)
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'announcement', value: {}, updated_at: new Date().toISOString() })
    setAnnBusy(false)
    if (error) {
      setAnnMsg('Could not clear: ' + error.message)
    } else {
      setAnn({})
      setAnnMsg('Cleared.')
    }
  }

  const field = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900'
  const label = 'mb-1 block text-xs font-medium text-slate-500'

  const roleLabel = isBoss ? 'Boss' : isAdmin ? 'Admin' : 'Staff'
  const roleStyle = isBoss
    ? 'bg-amber-100 text-amber-700'
    : isAdmin
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-slate-100 text-slate-600'
  const initial = (displayName || '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <Layout title="Settings" back={<BackLink fallback="/" />}>
      {/* Account (everyone) */}
      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-slate-900 text-lg font-bold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-slate-900">{displayName || 'Signed in'}</div>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${roleStyle}`}>
              {roleLabel}
            </span>
          </div>
          <button
            onClick={signOut}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 active:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </section>

      {/* Appearance (everyone) */}
      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Icon name="moon" className="h-4 w-4 text-slate-500" /> Appearance
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {(['light', 'dark', 'system'] as const).map((t) => (
            <button
              key={t}
              onClick={() => pickTheme(t)}
              className={
                'rounded-lg border px-2 py-2 text-sm font-medium capitalize ' +
                (theme === t
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-600 active:bg-slate-50')
              }
            >
              {t === 'system' ? 'System' : t}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          “System” follows your device’s light/dark setting automatically.
        </p>
      </section>

      {/* Notifications (everyone) */}
      <NotificationSettings />

      {/* Reports (everyone) */}
      <section className="mb-4">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Reports</h2>
        <Link
          to="/reports"
          className="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-sm active:bg-slate-50"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Icon name="cash" className="h-4 w-4 text-slate-500" /> Balance report
          </span>
          <span className="text-slate-300">›</span>
        </Link>
      </section>

      {/* Management (admin) */}
      {isAdmin && (
        <section className="mb-4">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Management</h2>
          <div className="space-y-2">
            <Link
              to="/staff"
              className="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-sm active:bg-slate-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Icon name="users" className="h-4 w-4 text-slate-500" /> Staff &amp; roles
              </span>
              <span className="text-slate-300">›</span>
            </Link>
            <Link
              to="/projects"
              className="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-sm active:bg-slate-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Icon name="folder" className="h-4 w-4 text-slate-500" /> Manage projects
              </span>
              <span className="text-slate-300">›</span>
            </Link>
            {isBoss && (
              <Link
                to="/suppliers"
                className="flex items-center justify-between rounded-xl bg-white p-3.5 shadow-sm active:bg-slate-50"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Icon name="truck" className="h-4 w-4 text-slate-500" /> Manage suppliers
                </span>
                <span className="text-slate-300">›</span>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Payment details (admin) */}
      {isAdmin && (
        <section className="mb-4 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Icon name="card" className="h-4 w-4 text-slate-500" /> Payment details
          </h2>
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
      )}

      {/* Announcement composer (boss only) */}
      {isBoss && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <Icon name="megaphone" className="h-4 w-4 text-slate-500" /> Announcement
          </h2>
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
        </section>
      )}
    </Layout>
  )
}
