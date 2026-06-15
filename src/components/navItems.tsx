import { useAuth } from '../contexts/AuthContext'

// Shared navigation definitions used by both the mobile BottomNav and the
// desktop/tablet Sidebar so the two stay in sync.
export interface NavTab {
  to: string
  label: string
  end: boolean
  icon: string
}

const baseTabs: NavTab[] = [
  { to: '/', label: 'Dashboard', end: true, icon: 'dashboard' },
  { to: '/units', label: 'Units', end: false, icon: 'home' },
  { to: '/schedule', label: 'Schedule', end: false, icon: 'calendar' },
  { to: '/quote', label: 'Quote', end: false, icon: 'receipt' },
  { to: '/quotes', label: 'Orders', end: false, icon: 'ledger' },
]

// The visible tabs for the current user (boss gets the Costing tab; guests only
// get the quotation generator).
export function useNavTabs(): NavTab[] {
  const { isBoss, isGuest } = useAuth()
  if (isGuest) return [{ to: '/quote', label: 'Quote', end: false, icon: 'receipt' }]
  return isBoss
    ? [...baseTabs, { to: '/costing', label: 'Costing', end: false, icon: 'coins' }]
    : baseTabs
}

export function TabIcon({ name, className = 'h-[22px] w-[22px]' }: { name: string; className?: string }) {
  const p = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
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
    case 'coins':
      return (
        <svg {...p}>
          <ellipse cx="8" cy="6.5" rx="5" ry="2.6" />
          <path d="M3 6.5v4c0 1.43 2.24 2.6 5 2.6s5-1.17 5-2.6v-4" />
          <ellipse cx="16" cy="14.5" rx="5" ry="2.6" />
          <path d="M11 14.5v4c0 1.43 2.24 2.6 5 2.6s5-1.17 5-2.6v-4" />
        </svg>
      )
    default:
      return null
  }
}
