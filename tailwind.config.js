/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper: '#f7f4ec',
        seal: {
          50: '#eef3f1',
          100: '#d8e4e0',
          200: '#aec7bf',
          300: '#80a89c',
          400: '#5c8d7d',
          500: '#3a7160',
          600: '#2c5a4c',
          700: '#23493d',
          800: '#1c3a31',
          900: '#142a24',
        },
        rust: {
          400: '#c2683f',
          500: '#a8512c',
          600: '#8c4022',
        },
        ink: {
          900: '#1c1a16',
          800: '#2a2722',
          700: '#3c3830',
          500: '#6b6458',
          300: '#a39c8d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 18, 34, 0.04), 0 8px 24px -8px rgba(15, 18, 34, 0.10)',
        cardHover: '0 2px 4px rgba(15, 18, 34, 0.06), 0 16px 32px -12px rgba(15, 18, 34, 0.16)',
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
        'spin-slow': 'spin 1.4s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
