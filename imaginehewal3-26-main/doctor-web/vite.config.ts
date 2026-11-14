import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Built straight into the backend, which serves it at /doctor/ on the same origin as the API (no CORS, no second server).
export default defineConfig({
  base: '/doctor/',
  plugins: [react()],
  build: { outDir: '../back/app/static/doctor', emptyOutDir: true },
  server: { port: 5173, proxy: { '/doctor-portal': 'http://localhost:8000' } },
});
