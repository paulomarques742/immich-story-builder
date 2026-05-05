/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],

  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#1a1814',
          soft:    '#3d3a35',
          muted:   '#7a756d',
          faint:   '#b8b2a8',
        },
        paper: {
          DEFAULT: '#faf8f5',
          warm:    '#f4f0ea',
          deep:    '#ede8e0',
        },
        accent: {
          DEFAULT: '#c4795a',
          soft:    '#d9957a',
          pale:    '#f2e4dc',
        },
        success: {
          DEFAULT: '#5a8a6a',
          pale:    '#e8f2ec',
        },
        danger: {
          DEFAULT: '#b05050',
          hover:   '#8f3f3f',
        },
        border: {
          DEFAULT: '#e8e2d8',
          strong:  '#d4cec4',
        },
      },

      fontFamily: {
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },

      fontWeight: {
        light:   '300',
        normal:  '400',
        medium:  '500',
      },

      fontSize: {
        '2xs': ['10px', { lineHeight: '1.4' }],
        xs:    ['11px', { lineHeight: '1.5' }],
        sm:    ['12px', { lineHeight: '1.6' }],
        base:  ['13px', { lineHeight: '1.6' }],
        md:    ['14px', { lineHeight: '1.5' }],
        lg:    ['15px', { lineHeight: '1.4' }],
        xl:    ['17px', { lineHeight: '1.3' }],
        '2xl': ['20px', { lineHeight: '1.25' }],
        '3xl': ['26px', { lineHeight: '1.2' }],
        '4xl': ['32px', { lineHeight: '1.15' }],
      },

      borderRadius: {
        none: '0',
        xs:   '2px',
        sm:   '4px',
        DEFAULT: '6px',
        lg:   '8px',
        xl:   '12px',
        full: '9999px',
      },

      boxShadow: {
        xs: '0 1px 3px rgba(26,24,20,0.07)',
        sm: '0 2px 8px rgba(26,24,20,0.09)',
        md: '0 8px 24px rgba(26,24,20,0.10)',
        lg: '0 24px 64px rgba(26,24,20,0.14)',
      },

      transitionTimingFunction: {
        'ease-editorial': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      height: {
        navbar:  '50px',
        toolbar: '44px',
      },

      maxWidth: {
        prose:  '65ch',
        story:  '900px',
        modal:  '560px',
        picker: '960px',
      },
    },
  },

  plugins: [],
};
