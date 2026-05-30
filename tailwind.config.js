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
        // === PHOSPHOR COLOR SYSTEM (CSS variable-based, theme-aware) ===
        phosphor: {
          teal: 'rgb(var(--color-phosphor-teal) / <alpha-value>)',
          'teal-bright': 'rgb(var(--color-phosphor-teal-bright) / <alpha-value>)',
          'teal-dim': 'rgb(var(--color-phosphor-teal-dim) / <alpha-value>)',
          green: 'rgb(var(--color-phosphor-green) / <alpha-value>)',
          'green-bright': 'rgb(var(--color-phosphor-green-bright) / <alpha-value>)',
          'green-dim': 'rgb(var(--color-phosphor-green-dim) / <alpha-value>)',
          red: 'rgb(var(--color-phosphor-red) / <alpha-value>)',
          'red-bright': 'rgb(var(--color-phosphor-red-bright) / <alpha-value>)',
          cyan: 'rgb(var(--color-phosphor-cyan) / <alpha-value>)',
          'cyan-dim': 'rgb(var(--color-phosphor-cyan-dim) / <alpha-value>)',
        },
        // === BACKGROUND SYSTEM ===
        void: 'rgb(var(--color-void) / <alpha-value>)',
        terminal: 'rgb(var(--color-terminal) / <alpha-value>)',
        panel: 'rgb(var(--color-panel) / <alpha-value>)',
        elevated: 'rgb(var(--color-elevated) / <alpha-value>)',
        'surface-border': 'rgb(var(--color-surface-border) / <alpha-value>)',
        // === TEXT SYSTEM ===
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        // === EXTRA ===
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        // === LEGACY INDUSIA (for backwards compatibility) ===
        indusia: {
          bg: 'rgb(var(--color-void) / <alpha-value>)',
          surface: 'rgb(var(--color-panel) / <alpha-value>)',
          surfaceMuted: 'rgb(var(--color-terminal) / <alpha-value>)',
          primary: 'rgb(var(--color-phosphor-teal) / <alpha-value>)',
          text: 'rgb(var(--color-text-primary) / <alpha-value>)',
          textMuted: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          pass: 'rgb(var(--color-phosphor-green) / <alpha-value>)',
          fail: 'rgb(var(--color-phosphor-red) / <alpha-value>)',
          warning: 'rgb(var(--color-warning) / <alpha-value>)',
          border: 'rgb(var(--color-surface-border) / <alpha-value>)',
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
        'glow-teal': '0 0 20px rgba(9, 168, 164, 0.3), 0 0 40px rgba(9, 168, 164, 0.1)',
        'glow-green': '0 0 20px rgba(0, 255, 102, 0.3), 0 0 40px rgba(0, 255, 102, 0.1)',
        'glow-red': '0 0 20px rgba(255, 68, 68, 0.3), 0 0 40px rgba(255, 68, 68, 0.1)',
        'glow-cyan': '0 0 20px rgba(91, 157, 255, 0.3), 0 0 40px rgba(91, 157, 255, 0.1)',
        'inner-glow-teal': 'inset 0 0 20px rgba(9, 168, 164, 0.1)',
        'panel': '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(rgba(9, 168, 164, 0.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(9, 168, 164, 0.06) 1px, transparent 1px)
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
