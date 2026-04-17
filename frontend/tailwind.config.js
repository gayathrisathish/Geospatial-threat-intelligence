/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: '#0f1117',
        'dark-panel': '#1a1d27',
        'dark-border': '#2d3148',
        'dark-muted': '#6b7280',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
}
