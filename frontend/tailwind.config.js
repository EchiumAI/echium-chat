/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    fontFamily: {
      body: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    extend: {
      transitionProperty: {
        width: 'width',
        height: 'height',
      },
      animation: {
        fastPulse: 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      // EchiumAI brand palette.
      // Token names are kept (`aws-*`) to avoid a sweeping refactor of every
      // component class reference; the values are remapped to the EchiumAI
      // purple/violet/blue scheme inspired by the logo gradient.
      colors: {
        // Dark surfaces (sidebar, headers): deep purple-black
        'aws-squid-ink': {
          light: '#1E1438',
          dark: '#0F0820',
        },
        // Primary accent (buttons, links): vibrant violet
        'aws-sea-blue': {
          light: '#7C3AED',
          dark: '#6D28D9',
        },
        'aws-sea-blue-hover': {
          light: '#6D28D9',
          dark: '#5B21B6',
        },
        // Secondary accent: indigo blue from the logo's cooler leaves
        'aws-aqua': '#6366F1',
        // Highlight / status accent: light violet
        'aws-lab': '#A78BFA',
        // Soft accent: pale lavender (chat avatar background, hover wash)
        'aws-mist': '#C4B5FD',
        'aws-font-color': {
          light: '#1E1438',
          dark: '#cacaca',
          gray: '#909193',
          blue: '#7C3AED',
        },
        'aws-font-color-white': {
          light: '#ffffff',
          dark: '#ececec',
        },
        'aws-ui-color': {
          dark: '#151515',
        },
        // Page background: very pale lavender / dark purple-gray
        'aws-paper': {
          light: '#F5F3FF',
          dark: '#1E1B2E',
        },
        red: '#dc2626',
        'light-red': '#fee2e2',
        yellow: '#f59e0b',
        'light-yellow': '#fef9c3',
        'dark-gray': '#6b7280',
        gray: '#9ca3af',
        'light-gray': '#e5e7eb',
      },
    },
  },
  // eslint-disable-next-line no-undef
  plugins: [require('@tailwindcss/typography'), require('tailwind-scrollbar')],
};
