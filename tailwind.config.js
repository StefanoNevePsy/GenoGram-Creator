/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // <--- QUESTA è la riga fondamentale da aggiungere!
  theme: {
    extend: {},
  },
  plugins: [],
}