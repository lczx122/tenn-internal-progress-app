import { NavLink } from 'react-router-dom'

// Bottom tab bar for the top-level screens. In-flow (not fixed) so it sits at
// the bottom of the 100dvh shell consistently, with safe-area padding to clear
// the home indicator. Monochrome line icons tint with the active state.
const tabs = [
  { to: '/', label: 'Dashboard', end: true, icon: 'dashboard' },
  { to: '/units', label: 'Units', end: false, icon: 'home' },
  { to: '/schedule', label: 'Schedule', end: false, icon: 'calendar' },
  { to: '/quote', label: 'Quote', end: false, icon: 'receipt' },
  { to: '/quotes', label: 'Orders', end: false, icon: 'ledger' },
] as const

function TabIcon({ name }: { name: string }) {
  const p = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-[22px] w-[22px]',
  }
  switch (name) {
    case 'dashboard':
      return (
        <svg {...p}>
          <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
        </svg>
      )
    case 'home':
      return (
        <svg {...p}>
          <path d="M3.5 11 12 3.5l8.5 7.5" />
          <path d="M5.5 9.8V20h13V9.8" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...p}>
          <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
          <path d="M3.5 9.5h17" />
          <path d="M8 3v4M16 3v4" />
        </svg>
      )
    case 'receipt':
      return (
        <svg {...p}>
          <path d="M6 2.6h12v18.8l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V2.6Z" />
          <path d="M9 7.5h6M9 11h6" />
        </svg>
      )
    case 'ledger':
      return (
        <svg {...p}>
          <rect x="3.5" y="4" width="17" height="16" rx="2.2" />
          <path d="M3.5 9.2h17" />
          <path d="M7.2 13h9.6M7.2 16.4h6" />
        </svg>
      )
    default:
      return null
  }
}

export function BottomNav() {
  return (
    <nav className="shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium ' +
              (isActive ? 'text-slate-900' : 'text-slate-400 active:text-slate-600')
            }
          >
            <TabIcon name={t.icon} />
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
