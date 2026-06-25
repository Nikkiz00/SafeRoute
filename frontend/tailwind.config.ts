import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        'brand-navy': '#020617',
        'brand-blue': '#2563EB',
        'brand-cyan': '#06B6D4',
        'brand-white': '#FFFFFF',

        // Safety
        'safety-green': '#22C55E',
        'safety-yellow': '#FACC15',
        'safety-red': '#EF4444',
        'safety-purple': '#8B5CF6',
        'safety-gray': '#CBD5E1',

        // Surface (semantic)
        'surface-base': '#F8FAFC',
        'surface-elevated': '#FFFFFF',
        'surface-dark': '#0F172A',
        'surface-dark-elevated': '#1E293B',

        // Text semantic
        'text-primary': '#0F172A',
        'text-secondary': '#64748B',
        'text-dark-primary': '#F1F5F9',
        'text-dark-secondary': '#94A3B8',

        // SOS
        'sos-red': '#DC2626',
        'sos-red-glow': '#EF4444',
        'sos-red-ring': '#FCA5A5',

        // Utility
        'offline-yellow': '#F59E0B',
        'border-light': '#E2E8F0',
        'border-dark': '#334155',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
      },
      borderRadius: {
        'none': '0',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
        'full': '9999px',
        'sheet': '1.5rem',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0,0,0,0.05)',
        'md': '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
        'lg': '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
        'xl': '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        '2xl': '0 25px 50px -12px rgba(0,0,0,0.25)',
        'sos': '0 0 0 8px rgba(239,68,68,0.25), 0 8px 25px rgba(220,38,38,0.5)',
        'sos-pulse': '0 0 0 16px rgba(239,68,68,0.1)',
        'map': '0 2px 12px rgba(0,0,0,0.15)',
        'sheet': '0 -4px 24px rgba(0,0,0,0.12)',
        'card': '0 1px 4px rgba(0,0,0,0.08)',
        'inner': 'inset 0 2px 4px 0 rgba(0,0,0,0.06)',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        '18': '4.5rem',
        '22': '5.5rem',
        '15': '3.75rem',
      },
      zIndex: {
        'map': '10',
        'sheet': '20',
        'nav': '30',
        'banner': '35',
        'modal': '40',
        'sos': '50',
        'toast': '60',
      },
      keyframes: {
        'pulse-sos': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(239,68,68,0)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-6px)' },
          '40%': { transform: 'translateX(6px)' },
          '60%': { transform: 'translateX(-4px)' },
          '80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'pulse-sos': 'pulse-sos 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        'fade-in': 'fade-in 0.15s ease-out',
        'shake': 'shake 300ms ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config
