import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/harmony/',
  plugins: [react()],
  build: {
    outDir: '../dist/harmony',
    emptyOutDir: true,
  },
});
