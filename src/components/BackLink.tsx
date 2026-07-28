import { useNavigate } from 'react-router-dom'

// True when there's an in-app page to go back to (React Router stamps an idx
// on history state; 0 = the entry the app was opened on).
function canGoBack(): boolean {
  const s = window.history.state as { idx?: number } | null
  return typeof s?.idx === 'number' && s.idx > 0
}

// Go back to the previous in-app page, or to `fallback` when the app was
// opened directly on this page (deep link / fresh PWA launch).
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate()
  return () => {
    if (canGoBack()) navigate(-1)
    else navigate(fallback)
  }
}

// The header back button. Real history-back, so pages return to wherever the
// user actually came from (Dashboard, Collection, Settings…) instead of a
// hardcoded route. Sized for touch (the old ← glyphs were ~20px, no padding).
export function BackLink({ fallback = '/' }: { fallback?: string }) {
  const goBack = useGoBack(fallback)
  return (
    <button
      onClick={goBack}
      aria-label="Back"
      className="-ml-2 min-h-[44px] min-w-[44px] rounded-lg px-2 text-xl leading-none text-slate-300 active:bg-surface/10 active:text-white"
    >
      ←
    </button>
  )
}
