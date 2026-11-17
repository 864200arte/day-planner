const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;
/** @type {import('tailwindcss').Config} */
export default {
  content: { relative: true, files: ['./index.html', './src/**/*.{ts,tsx}'] },
  theme: {
    extend: {
      colors: {
        bg: c('bg'), card: c('card'), card2: c('card2'), ink: c('ink'), mute: c('mute'),
        line: c('line'), accent: c('accent'), good: c('good'), warn: c('warn'), bad: c('bad'),
      },
      fontFamily: { sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
      borderRadius: { xl2: '22px' },
    },
  },
  plugins: [],
};
