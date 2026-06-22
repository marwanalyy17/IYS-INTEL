/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0f1117',
        surface: '#181c26',
        surface2: '#1e2333',
        border: 'rgba(255,255,255,0.07)',
        border2: 'rgba(255,255,255,0.13)',
        accent: '#5b6aff',
        success: '#2ecf8e',
        warn: '#ffc46b',
        danger: '#ff6b6b',
        info: '#4eaaff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
