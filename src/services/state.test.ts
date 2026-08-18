import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, type AppState } from './state.js';

describe('State Encoding & URL Handoff (state.ts)', () => {
  it('encodes and decodes state correctly round-trip', async () => {
    const originalState: AppState = {
      bookId: '2701',
      progress: 0.425,
      theme: 'sepia',
      fontSize: 20
    };

    const hash = await encodeState(originalState);
    expect(hash.startsWith('#s=')).toBe(true);

    const decoded = await decodeState(hash);
    expect(decoded).not.toBeNull();
    expect(decoded?.bookId).toBe('2701');
    expect(decoded?.progress).toBe(0.425);
    expect(decoded?.theme).toBe('sepia');
    expect(decoded?.fontSize).toBe(20);
  });

  it('handles uncompressed fallback URLs with u_ prefix', async () => {
    const state: AppState = {
      bookId: '84',
      progress: 0.85,
      theme: 'charcoal',
      fontSize: 18
    };

    const jsonStr = JSON.stringify(state);
    const uncompressedBase64 = btoa(encodeURIComponent(jsonStr))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const fallbackHash = `#s=u_${uncompressedBase64}`;

    const decoded = await decodeState(fallbackHash);
    expect(decoded).not.toBeNull();
    expect(decoded?.bookId).toBe('84');
    expect(decoded?.progress).toBe(0.85);
    expect(decoded?.theme).toBe('charcoal');
    expect(decoded?.fontSize).toBe(18);
  });

  it('returns null for empty or invalid hash prefixes', async () => {
    expect(await decodeState('')).toBeNull();
    expect(await decodeState('#')).toBeNull();
    expect(await decodeState('#chapter-1')).toBeNull();
    expect(await decodeState('#s=')).toBeNull();
  });

  it('returns null gracefully for corrupt or garbage payload strings', async () => {
    expect(await decodeState('#s=invalid_garbage!@#$%^&*()')).toBeNull();
    expect(await decodeState('#s=u_invalid_corrupted_json')).toBeNull();
  });
});
