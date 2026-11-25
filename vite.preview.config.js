import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Builds one self contained HTML file that opens straight from the computer, no server needed.
// Run: npx vite build --config vite.preview.config.js
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: { outDir: 'preview', assetsInlineLimit: 100000000, emptyOutDir: true },
})
