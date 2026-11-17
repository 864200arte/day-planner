import { fileURLToPath } from 'node:url';

// Шлях до конфігу задаємо явно, щоб Tailwind працював незалежно від поточної директорії запуску.
export default {
  plugins: {
    tailwindcss: { config: fileURLToPath(new URL('./tailwind.config.js', import.meta.url)) },
    autoprefixer: {},
  },
};
