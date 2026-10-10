/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        surface: '#F7F9FC',
        'surface-dim': '#E6ECF5',
        'surface-bright': '#FFFFFF',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#F1F5FA',
        'surface-container': '#E9EFF7',
        'surface-container-high': '#DFE7F1',
        'surface-container-highest': '#D4DEEB',
        'surface-variant': '#E9EFF7',

        'on-surface': '#0F1E3D',
        'on-surface-variant': '#4A5878',

        'inverse-surface': '#0F1E3D',
        'inverse-on-surface': '#F7F9FC',

        outline: '#94A1BB',
        'outline-variant': '#E1E7F0',
        'surface-tint': '#2E6BE6',

        // Primary — soft blue
        primary: '#2E6BE6',
        'on-primary': '#FFFFFF',
        'primary-container': '#E5EDFF',
        'on-primary-container': '#1A46A8',
        'inverse-primary': '#A9C4F8',

        // Secondary — teal accent
        secondary: '#0D9488',
        'on-secondary': '#FFFFFF',
        'secondary-container': '#CCFBF1',
        'on-secondary-container': '#0F766E',

        // Tertiary — kept, retuned to warm amber (used by old code)
        tertiary: '#D97706',
        'on-tertiary': '#FFFFFF',
        'tertiary-container': '#FEF3C7',
        'on-tertiary-container': '#92400E',

        // Status
        error: '#DC2626',
        'on-error': '#FFFFFF',
        'error-container': '#FEE2E2',
        'on-error-container': '#991B1B',

        success: '#16A34A',
        'on-success': '#FFFFFF',
        'success-container': '#DCFCE7',
        'on-success-container': '#166534',

        warning: '#D97706',
        'on-warning': '#FFFFFF',
        'warning-container': '#FEF3C7',
        'on-warning-container': '#92400E',

        info: '#0EA5E9',
        'on-info': '#FFFFFF',
        'info-container': '#E0F2FE',
        'on-info-container': '#075985',

        // Fixed variants (kept for backwards compat with older screens)
        'primary-fixed': '#E5EDFF',
        'primary-fixed-dim': '#A9C4F8',
        'on-primary-fixed': '#0B2A6B',
        'on-primary-fixed-variant': '#1A46A8',
        'secondary-fixed': '#CCFBF1',
        'secondary-fixed-dim': '#99F6E4',
        'on-secondary-fixed': '#042F2E',
        'on-secondary-fixed-variant': '#0F766E',
        'tertiary-fixed': '#FEF3C7',
        'tertiary-fixed-dim': '#FCD34D',
        'on-tertiary-fixed': '#451A03',
        'on-tertiary-fixed-variant': '#92400E',

        // Page
        background: '#F7F9FC',
        'on-background': '#0F1E3D',
      },

      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'display-md': ['28px', { lineHeight: '36px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-sm': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['20px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['16px', { lineHeight: '24px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.04em', fontWeight: '600' }],
        'table-data': ['13px', { lineHeight: '18px', fontWeight: '400' }],
      },

      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
        full: '9999px',
      },

      spacing: {
        'container-padding': '1.5rem',
        'element-gap': '0.75rem',
        // CHANGED: 240px → 260px (new spec)
        'sidebar-width': '260px',
        'drawer-width': '440px',
        'topbar-height': '64px',
        'bottomnav-height': '64px',
      },

      boxShadow: {
        card: '0 1px 2px rgba(15, 30, 61, 0.04), 0 4px 16px rgba(15, 30, 61, 0.04)',
        popover: '0 4px 12px rgba(15, 30, 61, 0.08), 0 12px 32px rgba(15, 30, 61, 0.08)',
        modal: '0 20px 60px rgba(15, 30, 61, 0.18)',
        drawer: '-8px 0 40px rgba(15, 30, 61, 0.10)',
        elevated: '0 2px 4px rgba(15, 30, 61, 0.04), 0 8px 24px rgba(15, 30, 61, 0.06)',
        focus: '0 0 0 3px rgba(46, 107, 230, 0.18)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
