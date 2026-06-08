import { NavLink } from 'react-router-dom'

// Fixed bottom tab bar for the two top-level screens. Phone-width, matches the
// app shell. Pages that show it should leave bottom padding (Layout does).
const tabs = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/units', label: 'Units', icon: '🏠', end: false },
  { to: '/quote', label: 'Quote', icon: '🧾', end: false },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ' +
              (isActive ? 'text-slate-900' : 'text-slate-400 active:text-slate-600')
            }
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
