/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk Variable"', '"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Interactive accent: "bus" cyan-teal — the digital/system color.
        // (Physical light ON uses amber, from Tailwind's built-in scale.)
        primary: {
          50:  '#ecfeff',
          100: '#cff9fc',
          200: '#a5f0f6',
          300: '#6fe3ed',
          400: '#3acfde',
          500: '#17b4c7',
          600: '#0e93a6',
          700: '#0f7586',
          800: '#135d6b',
          900: '#144d59',
          950: '#062f38',
        },
        // Surfaces: deep blue-graphite control-room palette.
        dark: {
          50:  '#f2f5fa',
          100: '#e6eaf2',
          200: '#c9d1e0',
          300: '#9aa6bd',
          400: '#6c7893',
          500: '#4a5468',
          600: '#343d52',
          700: '#232b3e',
          800: '#161d2e',
          900: '#0d1220',
          950: '#070b14',
        }
      },
      boxShadow: {
        // Warm halo for a lit lamp card — the design's signature.
        'lamp': '0 0 0 1px rgba(251,191,36,0.35), 0 0 24px -4px rgba(251,191,36,0.30), 0 0 72px -16px rgba(251,191,36,0.22)',
        'lamp-sm': '0 0 0 1px rgba(251,191,36,0.30), 0 0 18px -4px rgba(251,191,36,0.25)',
        'glow-cyan': '0 0 20px -6px rgba(58,207,222,0.45)',
        'panel': '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 8px 24px -12px rgba(0,0,0,0.5)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'ws-flash': {
          '0%': { boxShadow: '0 0 0 0 rgba(58,207,222,0.45)' },
          '100%': { boxShadow: '0 0 0 14px rgba(58,207,222,0)' },
        },
        'pulse-fire': {
          '0%': { boxShadow: '0 0 0 0 rgba(58,207,222,0.5)' },
          '100%': { boxShadow: '0 0 0 22px rgba(58,207,222,0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'ws-flash': 'ws-flash 0.9s ease-out 1',
        'pulse-fire': 'pulse-fire 0.6s ease-out 1',
      },
    },
  },
  plugins: [],
}
