import { describe, expect, it, vi } from 'vitest';
import { createSecureWindow } from '../../src/main/bootstrap/window.js';
import type { BrowserWindowConstructorOptions } from 'electron';

describe('secure BrowserWindow', () => {
  it('enables isolation and blocks navigation and new windows', async () => {
    let navigationHandler: ((event: { preventDefault(): void }) => void) | undefined;
    let newWindowHandler: (() => { action: 'deny' }) | undefined;
    const on = vi.fn((_event, handler) => { navigationHandler = handler; });
    const setWindowOpenHandler = vi.fn((handler) => { newWindowHandler = handler; });
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const show = vi.fn();
    let options: BrowserWindowConstructorOptions | undefined;
    const Factory = class {
      constructor(received: BrowserWindowConstructorOptions) { options = received; }
      webContents = { on, setWindowOpenHandler };
      loadURL = loadURL;
      show = show;
    };
    await createSecureWindow(Factory, '/safe/preload.js', 'file:///safe/index.html');
    expect(loadURL).toHaveBeenCalledWith('file:///safe/index.html');
    expect(show).toHaveBeenCalledOnce();
    expect(options).toMatchObject({ show: false, webPreferences: { preload: '/safe/preload.js', sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true } });
    expect(on).toHaveBeenCalledWith('will-navigate', expect.any(Function));
    expect(setWindowOpenHandler).toHaveBeenCalledWith(expect.any(Function));
    const preventDefault = vi.fn();
    navigationHandler?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(newWindowHandler?.()).toEqual({ action: 'deny' });
  });
});
