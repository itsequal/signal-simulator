import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base = process.env.BASE_PATH || '/';
const appVersion = (process.env.APP_VERSION ?? 'local').slice(0, 7);

export default defineConfig({
  base,
  plugins: [react()],
  worker: {

    format: 'es',
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {

    chunkSizeWarningLimit: 1400,
  },
});
