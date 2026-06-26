import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { TabIcon, useNavTabs, isTabActive } from './navItems'

// Left navigation rail for tablet/desktop (lg+). Hidden on phones, where the
// BottomNav is used instead. Shows the brand, the same tabs as the bottom bar,
// and the signed-in user with sign-out / admin link at the foot.
export function Sidebar() {
  const tabs = useNavTabs()
  const { pathname } = useLocation()
  const { displayName, isAdmin, signOut } = useAuth()
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-white lg:flex">
      <Link to="/" className="flex items-center gap-2.5 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-base font-bold">T</span>
        <span className="text-[15px] font-semibold leading-tight">
          Tenn<span className="block text-xs font-normal text-slate-400">Renovation</span>
        </span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ' +
              (isTabActive(pathname, t) ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')
            }
          >
            <TabIcon name={t.icon} className="h-5 w-5" />
            {t.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {isAdmin ? (
          <Link to="/staff" className="block rounded-lg px-3 py-2 hover:bg-white/5" title="Staff & roles">
            <div className="text-[11px] font-medium text-amber-300">Admin ⚙︎</div>
            <div className="truncate text-sm font-medium">{displayName}</div>
          </Link>
        ) : (
          <div className="px-3 py-2">
            <div className="text-[11px] text-slate-400">Signed in</div>
            <div className="truncate text-sm font-medium">{displayName}</div>
          </div>
        )}
        <button
          onClick={signOut}
          className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
