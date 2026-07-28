/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Semantic tokens backed by CSS variables (defined in index.css for
      // :root and .dark) — new UI written with these is dark-mode-correct
      // automatically, with no per-utility override rules.
      colors: {
        surface: 'var(--surface)', // card background
        'surface-2': 'var(--surface-2)', // subtle fill inside a card
        page: 'var(--page)', // page background / deep fill
        fill: 'var(--fill)', // stronger neutral fill (count pills, bars)
        ink: 'var(--ink)', // strongest text
        'ink-2': 'var(--ink-2)',
        body: 'var(--body)', // regular text
        muted: 'var(--muted)',
        'muted-2': 'var(--muted-2)',
        faint: 'var(--faint)', // timestamps, hints
        line: 'var(--line)', // default border
        'line-2': 'var(--line-2)', // stronger border (inputs)
        'line-faint': 'var(--line-faint)', // hairline dividers
        press: 'var(--press)', // active/hover feedback on surfaces
        'press-2': 'var(--press-2)',
        strong: 'var(--strong)', // focused-input border
        primary: 'var(--primary)', // primary buttons + selected controls
        'primary-press': 'var(--primary-press)',
        // Brand (from the quotation tool's identity)
        brand: { DEFAULT: '#152453', deep: '#0d1733' },
        accent: '#c8102e',
        gold: '#f3b84b',
      },
      fontFamily: {
        display: ['Archivo', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
