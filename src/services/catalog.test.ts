import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchCatalog, clearCatalogCache, type CatalogBook } from './catalog.js';

describe('Catalog Service (catalog.ts)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearCatalogCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fetches and returns catalog items from curator/catalog.json', async () => {
    const mockBooks: CatalogBook[] = [
      {
        id: '1342',
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        subjects: ['Classic Literature', 'Romance'],
        downloads: 50000
      }
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBooks
    } as Response);

    const catalog = await fetchCatalog();
    expect(catalog).toEqual(mockBooks);
    expect(globalThis.fetch).toHaveBeenCalled();
  });

  it('falls back to base catalog.json if curator/catalog.json fails', async () => {
    const mockFallbackBooks: CatalogBook[] = [
      {
        id: '2701',
        title: 'Moby Dick',
        author: 'Herman Melville',
        subjects: ['Sea Stories', 'Adventure'],
        downloads: 40000
      }
    ];

    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes('curator/catalog.json')) {
        return { ok: false, status: 404 } as Response;
      }
      return {
        ok: true,
        json: async () => mockFallbackBooks
      } as Response;
    });

    const catalog = await fetchCatalog();
    expect(catalog).toEqual(mockFallbackBooks);
    expect(callCount).toBe(2);
  });

  it('returns cached catalog on subsequent calls without making additional fetch requests', async () => {
    const mockBooks: CatalogBook[] = [{ id: '1', title: 'Test Book', author: 'Author', subjects: [], downloads: 10 }];
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBooks
    } as Response);
    globalThis.fetch = fetchSpy;

    // First call primes the cache
    const firstCall = await fetchCatalog();
    expect(firstCall).toEqual(mockBooks);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call should return cached data without additional fetch
    fetchSpy.mockClear();
    const secondCall = await fetchCatalog();
    expect(secondCall).toEqual(mockBooks);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns empty array gracefully on network failure', async () => {
    // Reset module to test clean failure path
    vi.resetModules();
    const { fetchCatalog: freshFetchCatalog } = await import('./catalog.js');

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const catalog = await freshFetchCatalog();
    expect(catalog).toEqual([]);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
