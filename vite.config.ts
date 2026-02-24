import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages usa /GenoGram-Creator/, Firebase usa /
  // Il workflow GitHub Actions imposta GITHUB_PAGES=true automaticamente
  base: process.env.GITHUB_PAGES === 'true' ? '/GenoGram-Creator/' : '/',
})