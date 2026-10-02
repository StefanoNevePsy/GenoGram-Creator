import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Content Security Policy per il sito su GitHub Pages (che non permette
// intestazioni HTTP: va in un <meta>). Solo lì: l'app desktop carica i file dal
// disco e quella Android ha il suo contenitore. L'app carica codice solo da sé
// stessa e si collega solo a Firebase (accesso anonimo e Firestore del progetto
// configurato): un eventuale difetto non può caricare script altrui né
// spedire genogrammi altrove.
const csp = (): Plugin => ({
    name: 'genogram-csp',
    apply: 'build',
    transformIndexHtml(html) {
        if (process.env.GITHUB_PAGES !== 'true') return html;
        const regole = [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self' data: blob: https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com",
            "frame-src https://*.firebaseapp.com",
            "worker-src 'self' blob:",
            "manifest-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ];
        return html.replace(/<meta charset="[^"]*"\s*\/?>/i, (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${regole.join('; ')}" />`);
    },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), csp()],
  // GitHub Pages usa /GenoGram-Creator/, Firebase usa /
  // Il workflow GitHub Actions imposta GITHUB_PAGES=true automaticamente
  base: process.env.GITHUB_PAGES === 'true' ? '/GenoGram-Creator/' : '/',
})
