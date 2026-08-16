import { describe, expect, it, vi } from 'vitest';
import { DashboardChannels } from '../../src/shared/contracts/dashboard.js';
import { isTrustedRendererSender, registerDashboardHandlers } from '../../src/main/ipc/dashboard.js';

describe('dashboard IPC boundary', () => {
  it('rejects untrusted or malformed requests without exposing internal errors', async () => {
    let handler: ((event: object, payload: unknown) => unknown) | undefined;
    registerDashboardHandlers({ handle: vi.fn((_channel, received) => { handler = received; }) }, { latestSummary: () => { throw new Error('sqlite path'); } }, () => true);
    expect(await handler?.({}, { version: 2 })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST', retryable: false } });
    expect(await handler?.({}, { version: 1 })).toMatchObject({ ok: false, error: { code: 'QUERY_FAILED', message: 'The dashboard could not be loaded.', retryable: true } });
    expect(DashboardChannels.get).toBe('dashboard.get.v1');
  });

  it('rejects a valid request from any sender other than the expected main-frame URL', async () => {
    let handler: ((event: object, payload: unknown) => unknown) | undefined;
    const expectedUrl = 'file:///app/index.html';
    registerDashboardHandlers(
      { handle: vi.fn((_channel, received) => { handler = received; }) },
      { latestSummary: () => null },
      (event) => isTrustedRendererSender(event as never, expectedUrl)
    );
    expect(await handler?.({ senderFrame: { parent: null, url: 'file:///other/index.html' } }, { version: 1 })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
    expect(isTrustedRendererSender({ senderFrame: { parent: {}, url: expectedUrl } } as never, expectedUrl)).toBe(false);
    expect(isTrustedRendererSender({ senderFrame: { parent: null, url: expectedUrl } } as never, expectedUrl)).toBe(true);
  });

  it('trusts the dev-server frame whose URL only differs from the configured origin by normalisation', () => {
    // Electron Forge exposes the dev server as an origin with no path; the loaded frame
    // reports it with a trailing slash. Both must resolve to the same trusted sender.
    const devServerUrl = 'http://localhost:5173';
    expect(isTrustedRendererSender({ senderFrame: { parent: null, url: 'http://localhost:5173/' } } as never, devServerUrl)).toBe(true);
    expect(isTrustedRendererSender({ senderFrame: { parent: null, url: 'http://localhost:5174/' } } as never, devServerUrl)).toBe(false);
    expect(isTrustedRendererSender({ senderFrame: { parent: null, url: 'http://localhost:5173/evil.html' } } as never, devServerUrl)).toBe(false);
    expect(isTrustedRendererSender({ senderFrame: { parent: null, url: 'not a url' } } as never, devServerUrl)).toBe(false);
  });
});
