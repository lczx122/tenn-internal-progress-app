import type { InputHTMLAttributes } from 'react'

// ---------------------------------------------------------------------------
//  Small shared UI atoms. These existed as near-identical copy-paste across
//  pages (six search bars, 15 "Loading…" strings, seven "pick one" styles) —
//  one source keeps them visually and behaviourally consistent.
// ---------------------------------------------------------------------------

// The standard filter-bar search input. text-base (16px) so iOS doesn't zoom
// on focus, type=search for the right keyboard + native clear button, and
// data-fed-skip so the pinned field editor doesn't hijack a simple search box.
export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props
  return (
    <input
      type="search"
      enterKeyHint="search"
      data-fed-skip
      {...rest}
      className={
        'min-w-0 rounded-lg border border-line-2 bg-surface px-3 py-2 text-base outline-none focus:border-strong ' +
        (className ?? 'flex-1')
      }
    />
  )
}

// One "pick one of N" control: equal-width bordered buttons, selected = ink.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={'flex gap-2 ' + (className ?? '')}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          aria-pressed={value === o.key}
          className={
            'min-h-[40px] flex-1 rounded-lg border px-2 text-sm font-medium ' +
            (value === o.key
              ? 'border-primary bg-primary text-white'
              : 'border-line-2 bg-surface text-muted active:bg-press')
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// The dashed empty-state card (same treatment everywhere; copy stays per-page).
export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={
        'rounded-xl border border-dashed border-line-2 py-12 text-center text-sm text-faint ' +
        (className ?? '')
      }
    >
      {children}
    </div>
  )
}

// Page loading placeholder. `skeleton` renders pulsing card outlines instead of
// bare text — used on pages without a warm cache (JobDetail, Reports, admin).
export function LoadingState({ skeleton = false }: { skeleton?: boolean }) {
  if (!skeleton) return <p className="py-10 text-center text-faint">Loading…</p>
  return (
    <div className="animate-pulse space-y-3 py-2" aria-label="Loading">
      <div className="h-28 rounded-xl bg-slate-200/60" />
      <div className="h-40 rounded-xl bg-slate-200/60" />
      <div className="h-28 rounded-xl bg-slate-200/60" />
    </div>
  )
}
