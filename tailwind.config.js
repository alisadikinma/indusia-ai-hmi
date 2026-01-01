/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,jsx,mdx}',
    './components/**/*.{js,jsx,mdx}',
    './app/**/*.{js,jsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        display: ['Barlow Condensed', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      colors: {
        // === PHOSPHOR COLOR SYSTEM ===
        phosphor: {
          amber: '#FFAA00',
          'amber-bright': '#FFD93D',
          'amber-dim': '#CC8800',
          green: '#00FF66',
          'green-bright': '#66FFAA',
          'green-dim': '#00CC52',
          red: '#FF4444',
          'red-bright': '#FF6B6B',
          cyan: '#00DDFF',
          'cyan-dim': '#0099BB',
        },
        // === BACKGROUND SYSTEM ===
        void: '#050608',
        terminal: '#0A0E14',
        panel: '#0D1117',
        elevated: '#161B22',
        'surface-border': '#21262D',
        // === TEXT SYSTEM ===
        'text-primary': '#E6EDF3',
        'text-secondary': '#8B949E',
        'text-tertiary': '#484F58',
        // === LEGACY INDUSIA (for backwards compatibility) ===
        indusia: {
          bg: '#050608',
          surface: '#0D1117',
          surfaceMuted: '#0A0E14',
          primary: '#FFAA00',
          text: '#E6EDF3',
          textMuted: '#8B949E',
          pass: '#00FF66',
          fail: '#FF4444',
          warning: '#FFAA00',
          border: '#21262D',
        },
      },
      spacing: {
        '2': '0.5rem',
        '4': '1rem',
        '6': '1.5rem',
        '8': '2rem',
        '12': '3rem',
        '16': '4rem',
        '20': '5rem',
        '24': '6rem',
        '32': '8rem',
        '40': '10rem',
      },
      fontSize: {
        'xxs': '0.65rem',
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
      },
      borderRadius: {
        'none': '0',
        'sm': '2px',
        'DEFAULT': '4px',
        'md': '6px',
        'lg': '8px',
        'xl': '12px',
      },
      boxShadow: {
        'glow-amber': '0 0 20px rgba(255, 170, 0, 0.3), 0 0 40px rgba(255, 170, 0, 0.1)',
        'glow-green': '0 0 20px rgba(0, 255, 102, 0.3), 0 0 40px rgba(0, 255, 102, 0.1)',
        'glow-red': '0 0 20px rgba(255, 68, 68, 0.3), 0 0 40px rgba(255, 68, 68, 0.1)',
        'glow-cyan': '0 0 20px rgba(0, 221, 255, 0.3), 0 0 40px rgba(0, 221, 255, 0.1)',
        'inner-glow-amber': 'inset 0 0 20px rgba(255, 170, 0, 0.1)',
        'panel': '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(rgba(255, 170, 0, 0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 170, 0, 0.06) 1px, transparent 1px)
        `,
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
        'scan-line': 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.03) 2px, rgba(0, 0, 0, 0.03) 4px)',
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'blink-error': 'blink-error 0.5s ease-in-out infinite',
        'flicker': 'flicker 4s linear infinite',
        'scan': 'scan-line 8s linear infinite',
        'typing-cursor': 'typing-cursor 1s step-end infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
        'blink-error': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.8' },
          '94%': { opacity: '1' },
          '97%': { opacity: '1' },
          '98%': { opacity: '0.9' },
          '99%': { opacity: '1' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'typing-cursor': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

module.exports = config;
