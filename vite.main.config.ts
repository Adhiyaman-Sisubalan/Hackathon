import { defineConfig } from 'vite';

export default defineConfig({
  build: { outDir: '.vite/build', emptyOutDir: false, rollupOptions: { external: ['electron'], output: { entryFileNames: 'main.js' } } }
});
