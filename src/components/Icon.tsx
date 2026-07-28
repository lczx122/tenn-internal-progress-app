// Shared outline-icon set, matching the bottom-nav TabIcon style
// (24×24, no fill, currentColor stroke, round joins). Icons inherit the
// surrounding text color, so they tint to whatever class the text uses.
// Used app-wide to replace decorative emoji. Unknown names render nothing.
export function Icon({ name, className = 'inline-block h-[18px] w-[18px] align-[-3px]' }: { name: string; className?: string }) {
  const p = {
    'aria-hidden': true,
    focusable: 'false' as const,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  }
  switch (name) {
    case 'map-pin': // site visit
      return (
        <svg {...p}>
          <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      )
    case 'ruler': // measurement
      return (
        <svg {...p}>
          <path d="M3.5 16.5 16.5 3.5l4 4-13 13-4-4Z" />
          <path d="M7 13l2 2M10 10l2 2M13 7l2 2" />
        </svg>
      )
    case 'wrench': // installation / setup
      return (
        <svg {...p}>
          <path d="M15.5 7.5a3.6 3.6 0 0 1-4.7 4.4l-5.3 5.3a1.8 1.8 0 0 1-2.5-2.5l5.3-5.3A3.6 3.6 0 0 1 12.7 4.5l-2.2 2.2 1.8 1.8 2.2-2.2c.3.4.7 1 1 1.2Z" />
        </svg>
      )
    case 'users': // meeting
      return (
        <svg {...p}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.5a3 3 0 0 1 0 5.6M17 13.5a5.5 5.5 0 0 1 3.5 5.1" />
        </svg>
      )
    case 'cash': // collection / money
      return (
        <svg {...p}>
          <rect x="2.5" y="6" width="19" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.6" />
          <path d="M5.5 9.5h.01M18.5 14.5h.01" />
        </svg>
      )
    case 'pin': // other / pin
      return (
        <svg {...p}>
          <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" />
          <path d="M12 14v7" />
        </svg>
      )
    case 'trending-up': // stage change
      return (
        <svg {...p}>
          <path d="M3 16.5 9.5 10l3.5 3.5L21 5.5" />
          <path d="M15.5 5.5H21v5.5" />
        </svg>
      )
    case 'key':
      return (
        <svg {...p}>
          <circle cx="8" cy="8" r="4.2" />
          <path d="M11 11l7.5 7.5M16 13l2.5 2.5M14.5 16l1.6 1.6" />
        </svg>
      )
    case 'flag': // created
      return (
        <svg {...p}>
          <path d="M5.5 21V4" />
          <path d="M5.5 5h11l-2 3 2 3h-11" />
        </svg>
      )
    case 'note':
      return (
        <svg {...p}>
          <rect x="4.5" y="3.5" width="15" height="17" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      )
    case 'user':
      return (
        <svg {...p}>
          <circle cx="12" cy="8" r="3.6" />
          <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
        </svg>
      )
    case 'home':
      return (
        <svg {...p}>
          <path d="M3.5 11 12 3.5l8.5 7.5" />
          <path d="M5.5 9.8V20h13V9.8" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...p}>
          <path d="M6.5 3.5 9 4l1 3.5-2 1.5a11 11 0 0 0 5 5l1.5-2L17 17l.5 2.5a2 2 0 0 1-2.2 1.8C9.4 20.6 3.4 14.6 2.7 6.7A2 2 0 0 1 4.5 4.5Z" />
        </svg>
      )
    case 'folder':
      return (
        <svg {...p}>
          <path d="M3.5 6.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2.2h8a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z" />
        </svg>
      )
    case 'megaphone':
      return (
        <svg {...p}>
          <path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H7l1.5 4h2L9 15.5h1l8 4V4.5l-8 4H5.5A1.5 1.5 0 0 0 4 10Z" />
          <path d="M18 9a3 3 0 0 1 0 6" />
        </svg>
      )
    case 'card':
      return (
        <svg {...p}>
          <rect x="2.5" y="5" width="19" height="14" rx="2.2" />
          <path d="M2.5 9.5h19M6 15h4" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...p}>
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'download':
      return (
        <svg {...p}>
          <path d="M12 3.5v11" />
          <path d="M8 11l4 4 4-4" />
          <path d="M4.5 19.5h15" />
        </svg>
      )
    case 'link':
      return (
        <svg {...p}>
          <path d="M9.5 14.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.3 1.3" />
          <path d="M14.5 9.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.3-1.3" />
        </svg>
      )
    case 'receipt': // quotation / document
      return (
        <svg {...p}>
          <path d="M6 2.6h12v18.8l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V2.6Z" />
          <path d="M9 7.5h6M9 11h6" />
        </svg>
      )
    case 'sparkles':
      return (
        <svg {...p}>
          <path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8Z" />
          <path d="M18 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" />
        </svg>
      )
    case 'check-circle':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M8.5 12.5l2.5 2.5 4.5-5" />
        </svg>
      )
    case 'alert': // warning triangle
      return (
        <svg {...p}>
          <path d="M12 3.5 21 19H3l9-15.5Z" />
          <path d="M12 9.5v4.5M12 16.8h.01" />
        </svg>
      )
    case 'moon': // appearance / theme
      return (
        <svg {...p}>
          <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" />
        </svg>
      )
    case 'truck': // supplier / delivery
      return (
        <svg {...p}>
          <path d="M3 6.5h11v9H3z" />
          <path d="M14 9.5h3.5L20 12.5v3h-6" />
          <circle cx="7" cy="17.5" r="1.6" />
          <circle cx="16.5" cy="17.5" r="1.6" />
        </svg>
      )
    case 'lock': // private
      return (
        <svg {...p}>
          <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
          <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          <path d="M12 14.5v2.5" />
        </svg>
      )
    case 'settings': // gear
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
        </svg>
      )
    default:
      return null
  }
}
