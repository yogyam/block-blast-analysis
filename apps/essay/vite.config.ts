import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The essay is a static single page. Base is relative so it can be hosted from any subpath.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', target: 'es2022' },
});
