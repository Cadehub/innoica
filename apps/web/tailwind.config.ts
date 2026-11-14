import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8FAFC',
        foreground: '#0F172A',
        card: '#FFFFFF',
        'card-foreground': '#0F172A',
        popover: '#FFFFFF',
        'popover-foreground': '#0F172A',
        primary: {
          DEFAULT: '#2563EB', // Electric Blue
          foreground: '#FFFFFF',
          hover: '#1D4ED8',
        },
        secondary: {
          DEFAULT: '#F1F5F9',
          foreground: '#0F172A',
        },
        accent: {
          DEFAULT: '#7C3AED', // Electric Violet
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F1F5F9',
          foreground: '#64748B',
        },
        destructive: {
          DEFAULT: '#EF4444',
          foreground: '#FFFFFF',
        },
        border: '#E2E8F0',
        input: '#E2E8F0',
        ring: '#2563EB',
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
    },
  },
  plugins: [],
};

export default config;
