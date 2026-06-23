import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import FieldEditor from './components/FieldEditor'
import { TopProgressBar } from './components/TopProgressBar'
import './index.css'

// Pin the app shell to the TRUE visible viewport height. iOS browsers and
// in-app webviews report an unreliable 100dvh — sometimes too short (a dead
// band of page background shows under the bottom nav) or too tall (the document
// scrolls separately from the content, so dragging the nav moves the page —
// the "two zones" feel). The visual viewport always reports what's actually on
// screen, so track it into --app-h; the shells use it ahead of 100dvh.
{
  const standalone = (navigator as { standalone?: boolean }).standalone
  const set = () => {
    const vv = window.visualViewport
    // Standalone keeps a stable layout viewport, so prefer the larger of the two
    // (the shell shouldn't shrink when the keyboard opens). In a browser, the
    // visual viewport is the source of truth for what is actually visible.
    const h = standalone ? Math.max(vv?.height ?? 0, window.innerHeight) : (vv?.height ?? window.innerHeight)
    document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`)
  }
  set()
  window.addEventListener('resize', set)
  window.addEventListener('orientationchange', set)
  window.visualViewport?.addEventListener('resize', set)
  // In a browser the toolbar grows/shrinks the visible area as you scroll.
  if (!standalone) window.visualViewport?.addEventListener('scroll', set)
  // WebKit sometimes corrects the viewport shortly after launch with no event.
  setTimeout(set, 250)
  setTimeout(set, 1000)
}

// Register the push service worker so reminder notifications can be delivered
// (push-only; it doesn't cache app assets).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <FieldEditor />
        <TopProgressBar />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
