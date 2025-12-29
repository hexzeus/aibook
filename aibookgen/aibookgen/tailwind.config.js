/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Premium dark surfaces
        surface: {
          0: '#0A0A0B',  // Deepest background
          1: '#141416',  // Cards, elevated
          2: '#1C1C1F',  // Hover states
          3: '#252529',  // Active states
        },
        // Premium accent colors
        brand: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',  // Primary gold
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
          950: '#451A03',
        },
        accent: {
          sage: '#10B981',      // Success, growth
          emerald: '#34D399',   // Bright success
          amber: '#F59E0B',     // Primary brand
          orange: '#FB923C',    // Warm accent
          rose: '#FB7185',      // Attention
          purple: '#A78BFA',    // Secondary accent
          cyan: '#22D3EE',      // Info
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#E5E7EB',
          tertiary: '#9CA3AF',
          muted: '#6B7280',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Christmas Brand', 'Poppins', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        'hero': ['clamp(2.5rem, 5vw, 4rem)', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
        'h1': ['clamp(2rem, 4vw, 3rem)', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'h2': ['clamp(1.5rem, 3vw, 2rem)', { lineHeight: '1.3' }],
        'h3': ['clamp(1.25rem, 2vw, 1.5rem)', { lineHeight: '1.4' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      maxWidth: {
        '8xl': '1400px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(245, 158, 11, 0.5)' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(245, 158, 11, 0.3)',
        'glow-lg': '0 0 30px rgba(245, 158, 11, 0.4)',
        'glow-xl': '0 0 40px rgba(245, 158, 11, 0.5)',
        'inner-glow': 'inset 0 0 20px rgba(245, 158, 11, 0.1)',
        'premium': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'premium-lg': '0 8px 40px rgba(0, 0, 0, 0.5)',
      },
      backdropBlur: {
        'xs': '2px',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
}
