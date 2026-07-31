import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // relative paths so `npm run build` output works from a file:// path,
  // a subfolder, or GitHub Pages without extra config
  base: './',
  server: { port: 5173 },
});
