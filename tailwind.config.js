const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,jsx,mdx}',
    './components/**/*.{js,jsx,mdx}',
    './app/**/*.{js,jsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        indusia: {
          bg: '#0A1628',
          surface: '#1A2942',
          surfaceMuted: '#152033',
          primary: '#0FB5BA',
          text: '#E8EDF2',
          textMuted: '#8A95A8',
          pass: '#10B981',
          fail: '#EF4444',
          warning: '#F59E0B',
          border: '#2D3E56',
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
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.875rem',
        '4xl': '2.25rem',
      },
      borderRadius: {
        'lg': '1rem',
        'xl': '1.25rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

module.exports = config;
