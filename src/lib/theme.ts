// Light / Dark / System theme. The preference is stored in localStorage and
// applied by toggling the `.dark` class on <html>; index.css re-themes the
// common neutral utilities under `.dark`. A no-flash inline script in index.html
// sets the class before first paint; this module owns changes + the system
// listener (only active while the preference is 'system').

export type Theme = 'light' | 'dark' | 'system'
const KEY = 'tenn-theme'
const mq = () => window.matchMedia('(prefers-color-scheme: dark)')

export function getTheme(): Theme {
  const t = localStorage.getItem(KEY)
  return t === 'light' || t === 'dark' || t === 'system' ? t : 'system'
}

export function resolvedTheme(theme: Theme = getTheme()): 'light' | 'dark' {
  return theme === 'system' ? (mq().matches ? 'dark' : 'light') : theme
}

export function applyTheme(theme: Theme = getTheme()) {
  const dark = resolvedTheme(theme) === 'dark'
  document.documentElement.classList.toggle('dark', dark)
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme)
  applyTheme(theme)
}

// Re-apply when the OS scheme changes, but only while following the system.
export function initThemeListener() {
  const handler = () => {
    if (getTheme() === 'system') applyTheme('system')
  }
  const m = mq()
  try {
    m.addEventListener('change', handler)
  } catch {
    // Safari < 14
    m.addListener(handler)
  }
}
