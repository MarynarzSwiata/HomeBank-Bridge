/** @type {import('tailwindcss').Config} */

// Light and dark themes (2026 redesign). Existing class names keep working: the `slate`
// scale is inverted (950 = page ground, 900 = card surface, 100 = ink), so the
// former dark UI renders light without touching every component. Accent colors
// are tuned for text contrast on white (>= 4.5:1).
// Shades are CSS variables (src/index.css) so the same classes serve light and dark themes.
const SHADES = {
  slate: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  indigo: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  emerald: [200, 300, 400, 500, 600, 950],
  rose: [200, 300, 400, 500, 600, 950],
  red: [400, 500, 950],
  amber: [200, 300, 400, 500, 950],
  sky: [300],
};

export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: Object.fromEntries(
        Object.entries(SHADES).map(([name, shades]) => [
          name,
          Object.fromEntries(shades.map(s => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`])),
        ])
      ),
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
      },
      fontWeight: {
        black: '600',
        extrabold: '600',
        bold: '600',
      },
      letterSpacing: {
        tighter: '-0.02em',
        tight: '-0.01em',
        wide: '0',
        wider: '0',
        widest: '0',
      },
      borderRadius: {
        xl: '10px',
        '2xl': '12px',
        '3xl': '14px',
      },
      boxShadow: {
        lg: '0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08)',
        xl: '0 4px 8px -2px rgba(16,24,40,.08), 0 2px 4px -2px rgba(16,24,40,.06)',
        '2xl': '0 12px 24px -6px rgba(16,24,40,.12), 0 4px 8px -4px rgba(16,24,40,.06)',
      },
    },
  },
  plugins: [],
}
