import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: { asar: true, extraResource: ['migrations'] },
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
