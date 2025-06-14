/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          orange: '#FF6B35',
          'orange-dark': '#E55A2B',
          'orange-light': '#FF8A5B',
        },
        secondary: {
          black: '#1A1A1A',
          gray: '#2D2D2D',
        },
        accent: {
          gray: '#404040',
        },
        text: {
          white: '#FFFFFF',
          gray: '#CCCCCC',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-in-out',
        'slide-up': 'slideUp 0.8s ease-out',
      }
    },
  },
  plugins: [],
} 