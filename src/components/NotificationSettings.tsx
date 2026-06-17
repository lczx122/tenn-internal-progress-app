import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  pushSupported,
  isStandalone,
  getPrefs,
  enablePush,
  disablePush,
  setLead,
  sendTest,
} from '../lib/push'

// Only this account sees the test-notification button.
const TEST_EMAIL = 'lczx122@gmail.com'

const PRESETS = [
  { m: 15, label: '15 min' },
  { m: 30, label: '30 min' },
  { m: 60, label: '1 hour' },
  { m: 180, label: '3 hours' },
  { m: 1440, label: '1 day' },
]

function leadLabel(m: number): string {
  if (m % 1440 === 0) return `${m / 1440} day${m / 1440 > 1 ? 's' : ''}`
  if (m % 60 === 0) return `${m / 60} hour${m / 60 > 1 ? 's' : ''}`
  return `${m} min`
}

// Reminder-notification settings: enable/disable push + how long before an
// event to be reminded. Used on the Schedule page.
export function NotificationSettings() {
  const [enabled, setEnabled] = useState(false)
  const [lead, setLeadState] = useState(30)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [customAmt, setCustomAmt] = useState('')
  const [customUnit, setCustomUnit] = useState<'min' | 'hour' | 'day'>('hour')

  const { session } = useAuth()
  const canTest = session?.user.email?.toLowerCase() === TEST_EMAIL

  const supported = pushSupported()
  const needsInstall = !supported && /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone()

  async function test() {
    setBusy(true)
    setMsg('Sending test…')
    try {
      const r = await sendTest()
      setMsg(r.ok ? `Test sent to ${r.sent ?? 0} device(s) — check your notifications.` : (r.error ?? 'Test failed.'))
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    getPrefs().then((p) => {
      setEnabled(p.enabled)
      setLeadState(p.lead_minutes)
    })
  }, [])

  async function toggle() {
    setBusy(true)
    setMsg('')
    try {
      if (enabled) {
        await disablePush()
        setEnabled(false)
        setMsg('Reminders turned off.')
      } else {
        await enablePush(lead)
        setEnabled(true)
        setMsg(`Reminders on — you’ll be notified ${leadLabel(lead)} before your events.`)
      }
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function pickLead(m: number) {
    setLeadState(m)
    setMsg('')
    if (enabled) {
      setBusy(true)
      try {
        await setLead(m)
        setMsg(`You’ll be reminded ${leadLabel(m)} before your events.`)
      } finally {
        setBusy(false)
      }
    }
  }

  function applyCustom() {
    const n = parseInt(customAmt, 10)
    if (!n || n < 1) return
    const mult = customUnit === 'day' ? 1440 : customUnit === 'hour' ? 60 : 1
    pickLead(n * mult)
    setCustomAmt('')
  }

  return (
    <div className="mb-3 rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-800">🔔 Reminder notifications</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Get a notification before appointments assigned to you.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={busy || !supported}
          aria-pressed={enabled}
          className={
            'relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ' +
            (enabled ? 'bg-emerald-500' : 'bg-slate-300')
          }
        >
          <span
            className={
              'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ' +
              (enabled ? 'left-[22px]' : 'left-0.5')
            }
          />
        </button>
      </div>

      {needsInstall ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          On iPhone, add this app to your Home Screen first (Share → Add to Home Screen), then open it
          from there to enable notifications.
        </p>
      ) : !supported ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          This browser doesn’t support notifications.
        </p>
      ) : (
        <>
          <p className="mb-1.5 mt-4 text-xs font-medium text-slate-600">Remind me before an event</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.m}
                onClick={() => pickLead(p.m)}
                disabled={busy}
                className={
                  'rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-50 ' +
                  (lead === p.m
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-600 active:bg-slate-50')
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-500">Custom:</span>
            <input
              type="number"
              min="1"
              value={customAmt}
              onChange={(e) => setCustomAmt(e.target.value)}
              placeholder="e.g. 45"
              className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900"
            />
            <select
              value={customUnit}
              onChange={(e) => setCustomUnit(e.target.value as 'min' | 'hour' | 'day')}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700"
            >
              <option value="min">minutes</option>
              <option value="hour">hours</option>
              <option value="day">days</option>
            </select>
            <button
              onClick={applyCustom}
              disabled={busy || !customAmt}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 active:bg-slate-50 disabled:opacity-50"
            >
              Set
            </button>
          </div>
          {!PRESETS.some((p) => p.m === lead) && (
            <p className="mt-1.5 text-xs text-slate-500">Currently: {leadLabel(lead)} before.</p>
          )}
        </>
      )}

      {canTest && supported && (
        <button
          onClick={test}
          disabled={busy}
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 active:bg-slate-50 disabled:opacity-50"
        >
          Send test notification
        </button>
      )}

      {msg && <p className="mt-3 text-xs text-slate-500">{msg}</p>}
    </div>
  )
}
