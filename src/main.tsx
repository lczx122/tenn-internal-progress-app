import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import FieldEditor from './components/FieldEditor'
import { TopProgressBar } from './components/TopProgressBar'
import { Toaster } from './components/Toaster'
import { DialogHost } from './components/DialogHost'
import { OfflineBanner } from './components/OfflineBanner'
import { applyTheme, initThemeListener } from './lib/theme'
import './index.css'

// Apply the saved theme (the index.html inline script avoids the first-paint
// flash; this keeps it in sync) and react to OS scheme changes when on "system".
applyTheme()
initThemeListener()

// Pin the app shell to the TRUE visible viewport height. iOS browsers and
// in-app webviews report an unreliable 100dvh — sometimes too short (a dead
// band of page background shows under the bottom nav) or too tall (the document
// scrolls separately from the content, so dragging the nav moves the page —
// the "two zones" feel). The visual viewport always reports what's actually on
// screen, so track it into --app-h; the shells use it ahead of 100dvh.
{
  const set = () => {
    // Some in-app webviews under-report visualViewport.height (leaving a dead
    // band under the nav); others report a stale innerHeight at launch. Take the
    // larger so the shell always fills the screen — the body is locked, so a few
    // px of overshoot just sits under the nav rather than creating a scroll.
    const h = Math.max(window.visualViewport?.height ?? 0, window.innerHeight)
    document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`)
  }
  set()
  window.addEventListener('resize', set)
  window.addEventListener('orientationchange', set)
  window.visualViewport?.addEventListener('resize', set)
  // The browser toolbar grows/shrinks the visible area as you scroll.
  window.visualViewport?.addEventListener('scroll', set)
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
        <Toaster />
        <DialogHost />
        <OfflineBanner />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
