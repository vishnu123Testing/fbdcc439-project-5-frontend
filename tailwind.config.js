/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: '#fbf9f4',
        'surface-dim': '#dbdad5',
        'surface-container': '#f0eee9',
        primary: '#59452b',
        secondary: '#a43b2c',
        tertiary: '#374a5f',
      },
    },
  },
  plugins: [],
};
