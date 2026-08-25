import type { Config } from 'tailwindcss';

// Tokens mirror /builds/thelma/design.md §5. All `derived` — no Figma source exists — so these
// are adjustable, and any change here is recorded in build-notes.md.
export default {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-sunken': 'var(--surface-sunken)',
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-subtle': 'var(--accent-subtle)',
        positive: 'var(--positive)',
        'positive-subtle': 'var(--positive-subtle)',
        negative: 'var(--negative)',
        'negative-subtle': 'var(--negative-subtle)',
        warning: 'var(--warning)',
        'warning-subtle': 'var(--warning-subtle)',
        info: 'var(--info)',
        'info-subtle': 'var(--info-subtle)',
        neutral: 'var(--neutral)',
        'neutral-subtle': 'var(--neutral-subtle)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        xs: '0.75rem', sm: '0.8125rem', base: '0.875rem', md: '1rem',
        lg: '1.125rem', xl: '1.375rem', '2xl': '1.75rem', '3xl': '2.25rem',
      },
      borderRadius: { sm: '4px', md: '6px', lg: '10px' },
      boxShadow: {
        sm: '0 1px 2px rgb(16 24 40 / 0.05)',
        md: '0 4px 8px -2px rgb(16 24 40 / 0.10), 0 2px 4px -2px rgb(16 24 40 / 0.06)',
        lg: '0 12px 16px -4px rgb(16 24 40 / 0.08), 0 4px 6px -2px rgb(16 24 40 / 0.03)',
      },
      spacing: { row: '2.75rem' },
    },
  },
  plugins: [],
} satisfies Config;
