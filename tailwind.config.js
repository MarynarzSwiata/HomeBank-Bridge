/** @type {import('tailwindcss').Config} */

// Light theme (2026 redesign). Existing class names keep working: the `slate`
// scale is inverted (950 = page ground, 900 = card surface, 100 = ink), so the
// former dark UI renders light without touching every component. Accent colors
// are tuned for text contrast on white (>= 4.5:1).
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: '#0F1115',
          100: '#16181D',
          200: '#1F2937',
          300: '#374151',
          400: '#4B5563',
          500: '#5B616E',
          600: '#6B7280',
          700: '#C9CDD4',
          800: '#E4E6EB',
          900: '#FFFFFF',
          950: '#F4F5F7',
        },
        indigo: {
          50: '#EEF2FD',
          100: '#DDE6FB',
          200: '#C9D6F7',
          300: '#1E3F9E',
          400: '#2F5BD3',
          500: '#3561D8',
          600: '#2F5BD3',
          700: '#2449AD',
          800: '#1E3F9E',
          900: '#172F75',
          950: '#E3EAFB',
        },
        emerald: {
          200: '#0B6B43',
          300: '#0B6B43',
          400: '#0B6B43',
          500: '#0F7B4F',
          600: '#0B6B43',
          950: '#ECFDF3',
        },
        rose: {
          200: '#7A1A12',
          300: '#B42318',
          400: '#B42318',
          500: '#C8301E',
          600: '#A71E14',
          950: '#FEECEB',
        },
        red: { 400: '#B42318', 500: '#C8301E', 950: '#FEF3F2' },
        amber: {
          200: '#7C2D12',
          300: '#9A3412',
          400: '#9A3412',
          500: '#B45309',
          950: '#FFF7ED',
        },
        sky: { 300: '#1E5FA8' },
      },
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
