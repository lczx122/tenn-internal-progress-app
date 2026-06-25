// Appointment types and small schedule helpers. Edit APPT_TYPES to add or
// rename appointment kinds — the form dropdown and badges follow automatically.

export interface ApptType {
  key: string
  label: string
  icon: string // Icon component name (see src/components/Icon.tsx)
  accent: string // tailwind badge classes
}

export const APPT_TYPES: ApptType[] = [
  { key: 'site_visit',   label: 'Site Visit',    icon: 'map-pin', accent: 'text-sky-700 bg-sky-50 border-sky-200' },
  { key: 'measurement',  label: 'Measurement',   icon: 'ruler',   accent: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { key: 'installation', label: 'Installation',  icon: 'wrench',  accent: 'text-amber-700 bg-amber-50 border-amber-200' },
  { key: 'meeting',      label: 'Meeting',       icon: 'users',   accent: 'text-violet-700 bg-violet-50 border-violet-200' },
  { key: 'collection',   label: 'Collection',    icon: 'cash',    accent: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { key: 'other',        label: 'Other',         icon: 'pin',     accent: 'text-slate-700 bg-slate-50 border-slate-200' },
]

const typeByKey = new Map(APPT_TYPES.map((t) => [t.key, t]))

export function getApptType(key: string): ApptType {
  return (
    typeByKey.get(key) ?? {
      key,
      label: key,
      icon: 'pin',
      accent: 'text-slate-700 bg-slate-50 border-slate-200',
    }
  )
}

export type ApptStatus = 'scheduled' | 'done' | 'cancelled'

export const STATUS_LABEL: Record<ApptStatus, string> = {
  scheduled: 'Scheduled',
  done: 'Done',
  cancelled: 'Cancelled',
}

// ---- date helpers (all local-time) ----

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

// "Today", "Tomorrow", "Yesterday", or a friendly date like "Mon, 8 Jun".
export function dayLabel(d: Date): string {
  const today = startOfDay(new Date())
  const day = startOfDay(d)
  const diff = Math.round((day.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

// Value for a <input type="datetime-local">, in local time.
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
