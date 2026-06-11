import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'

// iOS home-screen (standalone) apps launch with a stale layout viewport:
// WebKit still reserves space for Safari's toolbar until the first scroll, so
// 100dvh comes up short and the bottom nav floats above the home indicator.
// The visual viewport reports the true height from the start, so track the
// larger of the two in --app-h; the app shells use it ahead of 100dvh.
// (innerHeight wins while the keyboard is open, keeping the shell stable.)
if ((navigator as { standalone?: boolean }).standalone) {
  const set = () => {
    const h = Math.max(window.visualViewport?.height ?? 0, window.innerHeight)
    document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`)
  }
  set()
  window.addEventListener('resize', set)
  window.addEventListener('orientationchange', set)
  window.visualViewport?.addEventListener('resize', set)
  // WebKit sometimes corrects the viewport shortly after launch with no event.
  setTimeout(set, 250)
  setTimeout(set, 1000)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
