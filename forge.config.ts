import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  // This name is the user-facing app name and names the packaged bundle;
  // package.json `name` stays the npm identifier.
  packagerConfig: { name: 'Forseti', asar: true, extraResource: ['migrations'] },
  rebuildConfig: {},
  makers: [],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
        { entry: 'src/main/workers/report-worker.ts', config: 'vite.worker.config.ts' },
        { entry: 'src/preload/index.ts', config: 'vite.preload.config.ts' }
      ],
      renderer: [{ name: 'main_window', config: 'vite.renderer.config.ts' }]
    })
  ]
};

export default config;
