/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // Color and typography intentionally map to CSS custom properties set by the
    // active theme (see src/themes). Components must read from these, never from
    // hardcoded literals — a new theme is a new token bundle, not a component edit.
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-alt': 'var(--color-surface-alt)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        'accent-contrast': 'var(--color-accent-contrast)',
        winner: 'var(--color-winner)',
      },
      fontFamily: {
        label: 'var(--font-label)',
        numeral: 'var(--font-numeral)',
        display: 'var(--font-display)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
      },
    },
  },
  plugins: [],
}
