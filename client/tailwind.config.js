/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./*.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: '#1E3A5F',
        'brand-dark': '#0F1E32',
        action: '#15803D',
        'action-active': '#166534',
        surface: '#FFFFFF',
        background: '#F8FAFC',
        border: '#CBD5E1',
        'text-main': '#0F172A',
        'text-sub': '#475569',
        danger: '#B91C1C',
        warning: '#B45309',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Noto Sans Devanagari"',
          '"Noto Sans"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
