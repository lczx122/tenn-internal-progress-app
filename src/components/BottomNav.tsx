import { NavLink, useLocation } from 'react-router-dom'
import { TabIcon, useNavTabs, isTabActive } from './navItems'

// Bottom tab bar for the top-level screens on phones. Pinned with fixed bottom:0
// — on this device the in-flow shell stops ~62px short of the physical screen
// (the visible viewport reports 894 of 956px), but a fixed element reaches the
// true bottom edge, so this removes the dead space. safe-area padding lifts the
// labels above the home indicator. Hidden on lg+ where the Sidebar takes over.
// (Layout pads <main> by this bar's height so content isn't hidden behind it.)
export function BottomNav() {
  const tabs = useNavTabs()
  const { pathname } = useLocation()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-lg">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={
              'flex flex-1 flex-col items-center gap-1 pb-1 pt-2 text-[11px] font-medium ' +
              (isTabActive(pathname, t) ? 'text-slate-900' : 'text-slate-400 active:text-slate-600')
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
