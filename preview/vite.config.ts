import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Dev preview of the figure: `npm run preview:face`, then open the printed address (face map) or `/figur.html`
// (the rigged figure for a phone). `vite build --config preview/vite.config.ts` makes a static copy.
export default defineConfig({
  root: __dirname,
  base: './',
  server: { fs: { allow: ['..'] } },
  build: { outDir: resolve(__dirname, '../dist-preview'), emptyOutDir: true, target: 'es2022', rollupOptions: { input: { index: resolve(__dirname, 'index.html'), figur: resolve(__dirname, 'figur.html') } } },
})
