import { NavLink } from 'react-router-dom'
import { TabIcon, useNavTabs } from './navItems'

// Bottom tab bar for the top-level screens on phones. In-flow (not fixed) so it
// sits at the bottom of the shell, with safe-area padding to clear the home
// indicator. Hidden on lg+ where the Sidebar takes over.
export function BottomNav() {
  const tabs = useNavTabs()
  return (
    <nav className="shrink-0 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
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
