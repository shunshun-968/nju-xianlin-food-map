import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { campusCorePreload } from './scripts/vite-campus-preload.mjs';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    plugins: [react(), campusCorePreload()],
    base: env.VITE_BASE_PATH || '/nju-xianlin-food-map/',
    build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },
  };
});
