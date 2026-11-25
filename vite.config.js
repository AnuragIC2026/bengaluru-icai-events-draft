import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' lets the build run from any GitHub Pages path or subfolder.
export default defineConfig({
  plugins: [react()],
  base: './',
})
