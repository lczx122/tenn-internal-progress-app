import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { TabIcon, useNavTabs, isTabActive } from './navItems'
import { Icon } from './Icon'

// Left navigation rail for tablet/desktop (lg+). Hidden on phones, where the
// BottomNav is used instead. Shows the brand, the same tabs as the bottom bar,
// and the signed-in user with sign-out / admin link at the foot.
export function Sidebar() {
  const tabs = useNavTabs()
  const { pathname } = useLocation()
  const { displayName, isAdmin, signOut } = useAuth()
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-800 bg-primary text-white lg:flex">
      <Link to="/" className="flex items-center gap-2.5 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface/10 text-base font-bold">T</span>
        <span className="text-[15px] font-semibold leading-tight">
          Tenn<span className="block text-xs font-normal text-faint">Renovation</span>
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
              (isTabActive(pathname, t) ? 'bg-surface/15 text-white' : 'text-slate-300 hover:bg-surface/5 hover:text-white')
            }
          >
            <TabIcon name={t.icon} className="h-5 w-5" />
            {t.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Link to="/settings" className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-surface/5" title="Settings">
          <div className="min-w-0">
            <div className={'text-[11px] font-medium ' + (isAdmin ? 'text-amber-300' : 'text-faint')}>
              {isAdmin ? 'Admin' : 'Settings'}
            </div>
            <div className="truncate text-sm font-medium">{displayName}</div>
          </div>
          <Icon name="settings" className="h-4 w-4 shrink-0 text-faint" />
        </Link>
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
