import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync('src/renderer/styles/tokens.css', 'utf8');

describe('accessibility token system', () => {
  it('uses a single token layer for reduced motion and forced-colors modes', () => {
    expect(tokens).toContain('@media (prefers-reduced-motion: reduce)');
    expect(tokens).toContain('animation-duration: .01ms !important');
    expect(tokens).toContain('@media (forced-colors: active)');
    expect(tokens).toContain('--surface: Canvas');
    expect(tokens).toContain('--focus: Highlight');
  });
});
