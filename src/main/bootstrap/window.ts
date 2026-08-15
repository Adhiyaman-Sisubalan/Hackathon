import type { BrowserWindowConstructorOptions } from 'electron';

export interface BrowserWindowLike {
  loadURL(url: string): Promise<void>;
  show(): void;
  webContents: {
    on(event: 'will-navigate', listener: (event: { preventDefault(): void }) => void): void;
    setWindowOpenHandler(handler: () => { action: 'deny' }): void;
  };
}

export type BrowserWindowFactory = new (options: BrowserWindowConstructorOptions) => BrowserWindowLike;

export const secureWebPreferences = (preload: string): BrowserWindowConstructorOptions['webPreferences'] => ({
  preload,
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true
});

export function attachNavigationGuards(window: BrowserWindowLike): void {
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

export async function createSecureWindow(
  BrowserWindow: BrowserWindowFactory,
  preload: string,
  url: string
): Promise<BrowserWindowLike> {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    webPreferences: secureWebPreferences(preload)
  });
  attachNavigationGuards(window);
  await window.loadURL(url);
  window.show();
  return window;
}
