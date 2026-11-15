import { defineConfig } from 'vite'

// Dev preview of the figure's face map: `npm run preview:face`, then open the printed address.
export default defineConfig({ root: __dirname, server: { fs: { allow: ['..'] } } })
