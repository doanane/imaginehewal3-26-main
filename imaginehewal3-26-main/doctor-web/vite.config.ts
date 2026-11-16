import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Default: built straight into the backend, which serves it at /doctor/ on the same origin as the API.
// On Vercel (VERCEL=1) it is built to ./dist and served from the root; vercel.json forwards API calls to the backend.
const onVercel = !!process.env.VERCEL;
export default defineConfig({
  base: onVercel ? '/' : '/doctor/',
  plugins: [react()],
  build: { outDir: onVercel ? 'dist' : '../back/app/static/doctor', emptyOutDir: true },
  server: { port: 5173, proxy: { '/doctor-portal': 'http://localhost:8000' } },
});
