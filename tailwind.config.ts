import type { Config } from 'tailwindcss';

// 10X admin — pure white surfaces, ink text, lawn-green accent only.
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#000204',
          950: '#000204',
          900: '#0A0C12',
          800: '#2E2E2E',
          700: '#3A3A3A',
          600: '#4A4A4A',
        },
        paper: {
          DEFAULT: '#FFFFFF',
          50: '#FFFFFF',
          100: '#F7F8F7', // barely-there tint for hovers only
          200: '#ECEFEC', // hairline borders
          300: '#DDE2DD',
        },
        accent: {
          DEFAULT: '#6DE325',
          hover: '#5BC91D',
          pressed: '#4EA310',
          glow: '#D4FE4C',
          soft: '#F2FCE8', // whisper of green for selected states
          ink: '#000204',
        },
        fg: {
          DEFAULT: '#0A0C12',
          muted: '#5A6472',
          subtle: '#98A1AD',
          inverse: '#FFFFFF',
          'inverse-muted': '#B0B5C0',
        },
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'system-ui', '-apple-system', 'Arial', 'sans-serif'],
        display: ['var(--font-quantico)', 'var(--font-poppins)', 'system-ui', 'sans-serif'],
        quantico: ['var(--font-quantico)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Deliberately compact — Poppins stays readable small, screens stay calm.
        'display': ['1.375rem', { lineHeight: '1.25', fontWeight: '600', letterSpacing: '-0.01em' }],
        'title': ['1rem', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['0.8125rem', { lineHeight: '1.6' }],
        'body-sm': ['0.75rem', { lineHeight: '1.55' }],
        'caption': ['0.6875rem', { lineHeight: '1.45' }],
        'overline': ['0.625rem', { lineHeight: '1.2', letterSpacing: '0.12em', fontWeight: '600' }],
      },
      borderRadius: {
        none: '0',
        sm: '6px',
        DEFAULT: '10px',
        md: '12px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
        full: '9999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(10, 12, 18, 0.03), 0 6px 24px rgba(10, 12, 18, 0.05)',
        pop: '0 4px 12px rgba(10, 12, 18, 0.08), 0 12px 40px rgba(10, 12, 18, 0.12)',
        'glow-soft': '0 0 16px rgba(109, 227, 37, 0.25)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
