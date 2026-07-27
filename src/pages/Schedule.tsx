import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { realtimeChannel } from '../lib/realtime'
import { useAuth } from '../contexts/AuthContext'
import type { Appointment } from '../lib/types'
import { Layout } from '../components/Layout'
import { Icon } from '../components/Icon'
import { NotificationSettings } from '../components/NotificationSettings'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { cacheGet, cacheSet } from '../lib/pageCache'
import { progressStart, progressDone } from '../lib/progress'
import { usePersistedState, oneOf } from '../lib/usePersistedState'
import { toastErr } from '../lib/toast'
import { ErrorState } from '../components/ErrorState'
import {
  APPT_TYPES,
  getApptType,
  startOfDay,
  addDays,
  sameDay,
  dayLabel,
  timeLabel,
} from '../lib/appointments'

type Mode = 'agenda' | 'calendar'

export default function Schedule() {
  const c0 = cacheGet<Appointment[]>('schedule')
  const [appts, setAppts] = useState<Appointment[]>(c0 ?? [])
  const [loading, setLoading] = useState(!c0)
  const [loadFailed, setLoadFailed] = useState(false)
  const [mode, setMode] = usePersistedState<Mode>('tenn_schedule_mode', 'agenda', {
    validate: oneOf('agenda', 'calendar'),
  })
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = usePersistedState('tenn_schedule_type', '')
  const [showPast, setShowPast] = usePersistedState('tenn_schedule_showpast', false)
  const [month, setMonth] = useState(() => startOfDay(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()))
  const [scope, setScope] = usePersistedState<'mine' | 'all'>('tenn_schedule_scope', 'mine', {
    validate: oneOf('mine', 'all'),
  })
  const [showNotif, setShowNotif] = useState(false)
  const [pins, setPins] = useState<Set<string>>(() => new Set())
  const { session } = useAuth()
  const myId = session?.user.id
  const navigate = useNavigate()

  async function load() {
    progressStart()
    try {
      const [{ data, error }, { data: pinData }] = await Promise.all([
        supabase.from('appointments').select('*').order('starts_at', { ascending: true }),
        supabase.from('appointment_pins').select('appointment_id'),
      ])
      setLoadFailed(!!error)
      if (!error) {
        const next = (data as Appointment[]) ?? []
        setAppts(next)
        cacheSet('schedule', next)
        setPins(new Set((pinData ?? []).map((p: { appointment_id: string }) => p.appointment_id)))
      }
    } catch {
      setLoadFailed(true)
    } finally {
      setLoading(false)
      progressDone()
    }
  }

  // Pin / unpin for the signed-in user only (personal view). Optimistic, and
  // rolled back (with an error toast) if the write doesn't land.
  async function togglePin(id: string) {
    if (!myId) return
    const pinned = pins.has(id)
    const flip = (to: boolean) =>
      setPins((prev) => {
        const n = new Set(prev)
        if (to) n.add(id)
        else n.delete(id)
        return n
      })
    flip(!pinned)
    const { error } = pinned
      ? await supabase.from('appointment_pins').delete().eq('user_id', myId).eq('appointment_id', id)
      : await supabase.from('appointment_pins').insert({ user_id: myId, appointment_id: id })
    if (error) {
      flip(pinned)
      toastErr(`Could not ${pinned ? 'unpin' : 'pin'} — ${error.message}`)
    }
  }

  useEffect(() => {
    load()
    const channel = realtimeChannel('schedule')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_pins' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Refetch after waking from idle (realtime socket may have died).
  useAutoRefresh(load)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return appts.filter(
      (a) =>
        (scope === 'all' || (!!myId && (a.assignee_ids ?? []).includes(myId))) &&
        (!typeFilter || a.type === typeFilter) &&
        (!q ||
          a.title.toLowerCase().includes(q) ||
          a.customer_name.toLowerCase().includes(q) ||
          a.who.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q)),
    )
  }, [appts, query, typeFilter, scope, myId])

  return (
    <Layout title="Schedule" bottomNav onRefresh={load}>
      <div className="mb-3 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer, who, location…"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        <button
          onClick={() => setShowNotif((v) => !v)}
          title="Reminder notifications"
          aria-label="Reminder notifications"
          className={
            'shrink-0 rounded-lg border px-3 py-2 text-sm active:bg-slate-50 ' +
            (showNotif ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-600')
          }
        >
          <Icon name="bell" className="h-5 w-5" />
        </button>
        <button
          onClick={() => navigate('/schedule/new')}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white active:bg-slate-700"
        >
          + New
        </button>
      </div>

      {showNotif && <NotificationSettings />}

      <div className="mb-3 flex rounded-lg border border-slate-300 bg-white p-0.5">
        {(['mine', 'all'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={
              'flex-1 rounded-md px-2 py-1.5 text-sm font-medium ' +
              (scope === s ? 'bg-slate-900 text-white' : 'text-slate-600')
            }
          >
            {s === 'mine' ? 'My schedule' : 'Everyone'}
          </button>
        ))}
      </div>

      <div className="mb-3 flex gap-2">
        <div className="flex flex-1 rounded-lg border border-slate-300 bg-white p-0.5">
          {(['agenda', 'calendar'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={
                'flex-1 rounded-md px-2 py-1.5 text-sm font-medium capitalize ' +
                (mode === m ? 'bg-slate-900 text-white' : 'text-slate-600')
              }
            >
              {m}
            </button>
          ))}
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={`rounded-lg border bg-white px-2 py-2 text-sm outline-none focus:border-slate-900 ${typeFilter ? 'border-slate-900 font-medium' : 'border-slate-300 text-slate-600'}`}
        >
          <option value="">All types</option>
          {APPT_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="py-10 text-center text-slate-400">Loading…</p>
      ) : loadFailed && appts.length === 0 ? (
        <ErrorState onRetry={load} />
      ) : mode === 'agenda' ? (
        <Agenda
          items={filtered}
          showPast={showPast}
          onTogglePast={() => setShowPast((v) => !v)}
          pins={pins}
          onTogglePin={togglePin}
        />
      ) : (
        <CalendarView
          items={filtered}
          month={month}
          setMonth={setMonth}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          pins={pins}
          onTogglePin={togglePin}
        />
      )}
    </Layout>
  )
}

// ---------- agenda (grouped by day) ----------
function Agenda({
  items,
  showPast,
  onTogglePast,
  pins,
  onTogglePin,
}: {
  items: Appointment[]
  showPast: boolean
  onTogglePast: () => void
  pins: Set<string>
  onTogglePin: (id: string) => void
}) {
  const today = startOfDay(new Date())
  const now = Date.now()

  // Pinned tasks are pulled to the top of the user's own view, regardless of day
  // or the past/upcoming filter. Everything else flows in its day group.
  const pinned = items
    .filter((a) => pins.has(a.id))
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))

  const visible = items.filter((a) => {
    if (pins.has(a.id)) return false // shown in the Pinned section instead
    if (showPast) return true
    const day = startOfDay(new Date(a.starts_at))
    // upcoming days, plus anything overdue (past but still scheduled)
    return day >= today || (a.status === 'scheduled' && new Date(a.starts_at).getTime() < now)
  })

  const groups = useMemo(() => groupByDay(visible), [visible])

  return (
    <>
      <div className="mb-2 flex justify-end">
        <button onClick={onTogglePast} className="text-xs font-medium text-slate-500 underline">
          {showPast ? 'Hide past' : 'Show past & done'}
        </button>
      </div>
      {pinned.length > 0 && (
        <div className="mb-5">
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold text-slate-700">
            <Icon name="pin" className="h-4 w-4 text-amber-500" /> Pinned
          </h2>
          <ul className="space-y-2">
            {pinned.map((a) => (
              <ApptRow
                key={a.id}
                a={a}
                overdue={a.status === 'scheduled' && new Date(a.starts_at).getTime() < now}
                pinned
                onTogglePin={onTogglePin}
              />
            ))}
          </ul>
        </div>
      )}
      {groups.length === 0 && pinned.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-12 text-center text-slate-400">
          No appointments. Tap “+ New” to schedule one.
        </div>
      ) : (
        <div className="space-y-5 lg:columns-2 lg:gap-5 lg:space-y-0 2xl:columns-3 lg:[&>div]:mb-5 lg:[&>div]:break-inside-avoid">
          {groups.map((g) => (
            <div key={g.key}>
              <h2 className="mb-2 px-1 text-sm font-semibold text-slate-700">{dayLabel(g.date)}</h2>
              <ul className="space-y-2">
                {g.items.map((a) => (
                  <ApptRow
                    key={a.id}
                    a={a}
                    overdue={a.status === 'scheduled' && new Date(a.starts_at).getTime() < now}
                    pinned={pins.has(a.id)}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ---------- month calendar ----------
function CalendarView({
  items,
  month,
  setMonth,
  selectedDay,
  setSelectedDay,
  pins,
  onTogglePin,
}: {
  items: Appointment[]
  month: Date
  setMonth: (d: Date) => void
  selectedDay: Date
  setSelectedDay: (d: Date) => void
  pins: Set<string>
  onTogglePin: (id: string) => void
}) {
  const today = startOfDay(new Date())
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = addDays(first, -first.getDay()) // back up to Sunday
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  const countByDay = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of items) {
      const k = startOfDay(new Date(a.starts_at)).toDateString()
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [items])

  const dayItems = items
    .filter((a) => sameDay(new Date(a.starts_at), selectedDay))
    .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at))

  return (
    <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
      <div>
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="rounded-lg px-3 py-1.5 text-lg text-slate-500 active:bg-slate-100"
        >
          ‹
        </button>
        <span className="font-semibold text-slate-800">
          {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="rounded-lg px-3 py-1.5 text-lg text-slate-500 active:bg-slate-100"
        >
          ›
        </button>
      </div>

      <div className="rounded-xl bg-white p-2 shadow-sm">
        <div className="grid grid-cols-7 text-center text-[11px] font-medium text-slate-400">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const inMonth = d.getMonth() === month.getMonth()
            const isToday = sameDay(d, today)
            const isSel = sameDay(d, selectedDay)
            const count = countByDay.get(d.toDateString()) ?? 0
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelectedDay(startOfDay(d))}
                className={
                  'flex aspect-square flex-col items-center justify-center rounded-lg text-sm ' +
                  (isSel ? 'bg-slate-900 text-white' : isToday ? 'bg-slate-100' : '') +
                  (inMonth ? ' text-slate-800' : ' text-slate-300')
                }
              >
                <span className={isSel ? 'font-semibold' : ''}>{d.getDate()}</span>
                {count > 0 && (
                  <span
                    className={
                      'mt-0.5 h-1.5 w-1.5 rounded-full ' + (isSel ? 'bg-white' : 'bg-amber-500')
                    }
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      </div>

      <div className="lg:min-w-0">
      <h2 className="mb-2 mt-4 px-1 text-sm font-semibold text-slate-700 lg:mt-0">{dayLabel(selectedDay)}</h2>
      {dayItems.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm text-slate-400">
          Nothing scheduled.
        </p>
      ) : (
        <ul className="space-y-2">
          {dayItems.map((a) => (
            <ApptRow
              key={a.id}
              a={a}
              overdue={a.status === 'scheduled' && new Date(a.starts_at).getTime() < Date.now()}
              pinned={pins.has(a.id)}
              onTogglePin={onTogglePin}
            />
          ))}
        </ul>
      )}
      </div>
    </div>
  )
}

// ---------- one appointment row ----------
export function ApptRow({
  a,
  overdue,
  pinned,
  onTogglePin,
}: {
  a: Appointment
  overdue?: boolean
  pinned?: boolean
  onTogglePin?: (id: string) => void
}) {
  const t = getApptType(a.type)
  const muted = a.status !== 'scheduled'
  return (
    <li>
      <Link
        to={`/appointment/${a.id}`}
        className={'block rounded-xl bg-white p-3 shadow-sm active:bg-slate-50 ' + (muted ? 'opacity-60' : '')}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${t.accent}`}>
                <Icon name={t.icon} className="h-3.5 w-3.5" /> {t.label}
              </span>
              {a.is_private && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  <Icon name="lock" className="h-3 w-3" /> Private
                </span>
              )}
              <span className="text-sm font-medium text-slate-700">{timeLabel(a.starts_at)}</span>
            </div>
            <p className={'mt-1 truncate font-semibold text-slate-900 ' + (a.status === 'done' ? 'line-through' : '')}>
              {a.title || a.customer_name || t.label}
            </p>
            {(a.customer_name || a.location) && (
              <p className="truncate text-xs text-slate-500">
                {[a.customer_name, a.location].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 max-w-[45%]">
            {onTogglePin && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onTogglePin(a.id)
                }}
                aria-label={pinned ? 'Unpin' : 'Pin to top'}
                title={pinned ? 'Unpin' : 'Pin to top'}
                className={'-mr-1 -mt-1 rounded-md p-1 ' + (pinned ? 'text-amber-500' : 'text-slate-300 active:text-slate-500')}
              >
                <Icon name="pin" className="h-4 w-4" />
              </button>
            )}
            {overdue && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">Overdue</span>
            )}
            {a.status === 'done' && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Done</span>
            )}
            {a.status === 'cancelled' && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">Cancelled</span>
            )}
            {a.who && (
              <span className="line-clamp-2 break-words text-right text-xs text-slate-400">{a.who}</span>
            )}
          </div>
        </div>
      </Link>
    </li>
  )
}

function groupByDay(items: Appointment[]): { key: string; date: Date; items: Appointment[] }[] {
  const map = new Map<string, { key: string; date: Date; items: Appointment[] }>()
  for (const a of items) {
    const d = startOfDay(new Date(a.starts_at))
    const key = d.toDateString()
    if (!map.has(key)) map.set(key, { key, date: d, items: [] })
    map.get(key)!.items.push(a)
  }
  return [...map.values()].sort((x, y) => +x.date - +y.date)
}
