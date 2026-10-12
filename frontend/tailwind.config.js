/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#060912',
        'bg-raised': '#0B1120',
        card: '#0F1626',
        border: 'rgba(148, 163, 184, 0.14)',
        text: '#E8EEF8',
        'text-muted': '#8B98B0',
        solar: '#FFC857',
        demand: '#38BDF8',
        forecast: '#38BDF8',
        battery: '#34D399',
        ok: '#22C55E',
        warn: '#F59E0B',
        danger: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 4px 20px -2px rgba(0, 0, 0, 0.45)',
        'card-hover': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), 0 8px 24px -2px rgba(0, 0, 0, 0.55)',
        glow: '0 0 20px -5px rgba(56, 189, 248, 0.15)',
        'glow-danger': '0 0 25px -4px rgba(239, 68, 68, 0.3)',
      },
      animation: {
        'pulse-subtle': 'pulseSubtle 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'edge-flash': 'edgeFlash 0.8s ease-out forwards',
      },
      keyframes: {
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.75' },
        },
        edgeFlash: {
          '0%': { boxShadow: 'inset 0 0 50px rgba(239, 68, 68, 0.6)' },
          '100%': { boxShadow: 'inset 0 0 0 rgba(239, 68, 68, 0)' },
        }
      }
    },
  },
  plugins: [],
};
