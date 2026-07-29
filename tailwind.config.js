/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f4fef0',
          100: '#e5fddd',
          200: '#c7fab7',
          300: '#9ff584',
          400: '#70f547',
          500: '#3bff00',
          600: '#32d600',
          700: '#1f8500',
          800: '#186600',
          900: '#114700',
        },
        surface: {
          DEFAULT: '#0f1117',
          raised: '#171a23',
          muted: '#1f2330',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.4)', opacity: '0' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        blink: {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        blink: 'blink 1.4s infinite',
      },
    },
  },
  plugins: [],
};