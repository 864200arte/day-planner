import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';

/** Генерує dist/sw.js: підставляє список файлів для офлайн-кешу та версію. */
function swPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'dp-sw',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const files: string[] = [];
      const walk = (d: string) => {
        for (const f of readdirSync(d)) {
          const p = join(d, f);
          if (statSync(p).isDirectory()) walk(p);
          else files.push(relative(outDir, p).split(sep).join('/'));
        }
      };
      walk(outDir);
      const list = files.filter((f) => f !== 'sw.js');
      const h = createHash('sha1');
      for (const f of list) h.update(readFileSync(join(outDir, f)));
      h.update(readFileSync('src/sw.template.js'));
      const version = h.digest('hex').slice(0, 10);
      const tpl = readFileSync('src/sw.template.js', 'utf8')
        .replace(/__VERSION__/g, version)
        .replace('"__PRECACHE__"', JSON.stringify(list));
      writeFileSync(join(outDir, 'sw.js'), tpl);
    },
  };
}

export default defineConfig({
  plugins: [react(), swPlugin()],
  base: './',
  build: { target: 'es2021', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
