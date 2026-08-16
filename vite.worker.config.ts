import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: '.vite/build', emptyOutDir: false, rollupOptions: { output: { entryFileNames: 'report-worker.js' } } }
});
