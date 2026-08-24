import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF9E62',
          dark: '#E88A00',
        },
        'awa-header': '#1a1a2e',
        'awa-sub': '#FFDDC8',
      },
      fontFamily: {
        josefin: ['var(--font-josefin)', 'sans-serif'],
        inter: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
