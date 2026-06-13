/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          strong: 'rgb(var(--brand-strong) / <alpha-value>)',
          fg: 'rgb(var(--brand-fg) / <alpha-value>)',
          soft: 'rgb(var(--brand-soft) / <alpha-value>)',
        },
        accent: 'rgb(var(--accent) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04)',
        elevated: '0 4px 24px -4px rgb(0 0 0 / 0.12)',
        pop: '0 16px 48px -12px rgb(0 0 0 / 0.25)',
      },
      borderRadius: {
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'scale-in': 'scale-in 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
