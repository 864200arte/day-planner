// Генерує PNG-іконки з public/icon.svg (потрібен devDependency sharp). Запуск: npm run icons
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';

const svg = readFileSync('public/icon.svg');
mkdirSync('public/icons', { recursive: true });
const out = (name, size, pad = 0) =>
  pad
    ? sharp(svg).resize(Math.round(size * (1 - pad * 2)), Math.round(size * (1 - pad * 2))).extend({ top: Math.round(size * pad), bottom: Math.round(size * pad), left: Math.round(size * pad), right: Math.round(size * pad), background: '#6d5cf0' }).png().toFile(`public/icons/${name}`)
    : sharp(svg).resize(size, size).png().toFile(`public/icons/${name}`);

await Promise.all([
  out('apple-touch-icon.png', 180),   // iOS не любить прозорість — фон суцільний
  out('icon-192.png', 192),
  out('icon-512.png', 512),
  out('icon-maskable-512.png', 512, 0.1),
  out('icon-32.png', 32),
]);
console.log('Іконки створено в public/icons');
