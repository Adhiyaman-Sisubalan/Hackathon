import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Serves the renderer in a plain browser (Codespaces, or any machine without a desktop),
 * backed by dev/web/mock-bridge.ts instead of the Electron preload bridge.
 * The Electron build is unaffected and still uses vite.renderer.config.ts.
 */
const inCodespace = Boolean(process.env.CODESPACES);

export default defineConfig({
  plugins: [
    react({}),
    {
      // The forwarded Codespaces URL opens "/", so serve the preview page there.
      name: 'reconciliation-web-preview-root',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url === '/' || request.url === '/index.html') request.url = '/web.html';
          next();
        });
      }
    }
  ],
  server: {
    // Codespaces proxies the port from outside the container, so bind every interface
    // and let the HMR socket reach the browser over the forwarded HTTPS origin.
    host: true,
    port: 5173,
    ...(inCodespace ? { hmr: { clientPort: 443, protocol: 'wss' as const } } : {})
  }
});
