import { defineConfig } from 'vite'

// The Fayo MVP: `npm run demo:fayo` to try it, `npm run build:fayo` to build it for GitHub Pages
// (served under /anima-lab-design/fayo/).
export default defineConfig({
  root: __dirname,
  base: './',
  server: { fs: { allow: ['../..'] } },
  build: { outDir: '../../dist/fayo', emptyOutDir: true, target: 'es2022', assetsInlineLimit: 0 },
})
