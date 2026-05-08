import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/brainstorm/',
  plugins: [react()],
  build: {
    outDir: '../dist/brainstorm',
    emptyOutDir: true,
  },
});
