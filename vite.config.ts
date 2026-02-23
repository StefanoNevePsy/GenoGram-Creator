import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANTE: Sostituisci 'GenoGram-Creator' con il nome esatto del tuo repo su GitHub
  // Deve iniziare e finire con uno slash /
  //base: '/GenoGram-Creator/', //Decommentare per Github
  base: '/', //Decommentare per Firebase
})