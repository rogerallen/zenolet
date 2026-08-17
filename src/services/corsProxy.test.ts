import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore
import worker from '../../worker/index.js';
import { buildProxyUrl, fetchWithProxyFallback } from './corsProxy.ts';

describe('buildProxyUrl URL Parsing', () => {
  it('correctly constructs proxied URLs for localhost proxy endpoints', () => {
    const target = 'https://www.gutenberg.org/cache/epub/245/pg245-images.html';
    const proxy = 'http://localhost:8787';
    const result = buildProxyUrl(target, proxy);
    expect(result).toBe(
      'http://localhost:8787/?url=https%3A%2F%2Fwww.gutenberg.org%2Fcache%2Fepub%2F245%2Fpg245-images.html'
    );
  });

  it('correctly constructs proxied URLs for Cloudflare workers.dev endpoints', () => {
    const target = 'https://www.gutenberg.org/cache/epub/245/pg245-images.html';
    const proxy = 'https://zenolet-cors-proxy.rallen-e12.workers.dev';
    const result = buildProxyUrl(target, proxy);
    expect(result).toBe(
      'https://zenolet-cors-proxy.rallen-e12.workers.dev/?url=https%3A%2F%2Fwww.gutenberg.org%2Fcache%2Fepub%2F245%2Fpg245-images.html'
    );
  });

  it('correctly constructs proxied URLs when proxy ends with ?url=', () => {
    const target = 'https://example.com';
    const proxy = 'http://localhost:8787/?url=';
    const result = buildProxyUrl(target, proxy);
    expect(result).toBe('http://localhost:8787/?url=https%3A%2F%2Fexample.com');
  });
});

describe('processBookHtml Image Resolution & Caching', () => {
  it('resolves relative image URLs against book baseUrl and adds proxy prefix', async () => {
    const { processBookHtml } = await import('./corsProxy.ts');
    const rawHtml = '<p>Chapter 1</p><img src="images/cover.jpg" alt="Cover">';
    const bookUrl = 'https://www.gutenberg.org/cache/epub/1342/pg1342-images.html';
    const proxy = 'http://localhost:8787';

    const processed = processBookHtml(rawHtml, bookUrl, proxy);
    expect(processed).toContain(
      'src="http://localhost:8787/?url=https%3A%2F%2Fwww.gutenberg.org%2Fcache%2Fepub%2F1342%2Fimages%2Fcover.jpg"'
    );
  });

  it('preserves already-proxied URLs without double-proxying on revisit', async () => {
    const { processBookHtml } = await import('./corsProxy.ts');
    const alreadyProxiedHtml =
      '<img src="http://localhost:8787/?url=https%3A%2F%2Fwww.gutenberg.org%2Fcache%2Fepub%2F1342%2Fimages%2Fcover.jpg">';
    const bookUrl = 'https://www.gutenberg.org/cache/epub/1342/pg1342-images.html';
    const proxy = 'http://localhost:8787';

    const processed = processBookHtml(alreadyProxiedHtml, bookUrl, proxy);
    expect(processed).toBe(
      '<img src="http://localhost:8787/?url=https%3A%2F%2Fwww.gutenberg.org%2Fcache%2Fepub%2F1342%2Fimages%2Fcover.jpg" style="max-width: 100%; max-height: calc(100vh - 160px); height: auto; object-fit: contain;">'
    );
  });

  it('preserves data:image base64 URLs without modifying them', async () => {
    const { processBookHtml } = await import('./corsProxy.ts');
    const dataUrlHtml =
      '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==">';
    const bookUrl = 'https://www.gutenberg.org/cache/epub/1342/pg1342-images.html';
    const proxy = 'http://localhost:8787';

    const processed = processBookHtml(dataUrlHtml, bookUrl, proxy);
    expect(processed).toContain('src="data:image/png;base64,');
  });

  it('downloads external images via proxy and inlines them as base64 data URLs in cacheBookImagesOffline', async () => {
    const { cacheBookImagesOffline } = await import('./corsProxy.ts');
    const inputHtml =
      '<p>Text</p><img src="http://localhost:8787/?url=https%3A%2F%2Fwww.gutenberg.org%2Fcache%2Fepub%2F1342%2Fimages%2Fcover.jpg">';
    const proxy = 'http://localhost:8787';

    const fakeImageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
    const mockImageBlob = new Blob([fakeImageBytes], { type: 'image/png' });
    const mockImageResponse = new Response(mockImageBlob, {
      status: 200,
      headers: { 'Content-Type': 'image/png' }
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(mockImageResponse);

    try {
      const result = await cacheBookImagesOffline(inputHtml, proxy);
      expect(result).toContain('src="data:image/png;base64,');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        'http://localhost:8787/?url=https%3A%2F%2Fwww.gutenberg.org%2Fcache%2Fepub%2F1342%2Fimages%2Fcover.jpg'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('retains original image src if image fetch fails in cacheBookImagesOffline', async () => {
    const { cacheBookImagesOffline } = await import('./corsProxy.ts');
    const inputHtml = '<img src="http://localhost:8787/?url=https%3A%2F%2Fwww.gutenberg.org%2Fimages%2Fmissing.jpg">';
    const proxy = 'http://localhost:8787';

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('Not Found', { status: 404 }));

    try {
      const result = await cacheBookImagesOffline(inputHtml, proxy);
      expect(result).toContain(
        'src="http://localhost:8787/?url=https%3A%2F%2Fwww.gutenberg.org%2Fimages%2Fmissing.jpg"'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Worker Proxy Security & CORS Preflight', () => {
  it('handles OPTIONS preflight request for allowed GitHub Pages origin', async () => {
    const req = new Request('https://proxy.workers.dev/?url=https://example.com', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://rogerallen.github.io'
      }
    });

    const res = await worker.fetch(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://rogerallen.github.io');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  it('handles OPTIONS preflight request for local dev origin', async () => {
    const req = new Request('https://proxy.workers.dev/?url=https://example.com', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173'
      }
    });

    const res = await worker.fetch(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('handles OPTIONS preflight request for Tailscale domain', async () => {
    const req = new Request('https://proxy.workers.dev/?url=https://example.com', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://my-server.ts.net'
      }
    });

    const res = await worker.fetch(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://my-server.ts.net');
  });

  it('rejects OPTIONS preflight from unauthorized origins', async () => {
    const req = new Request('https://proxy.workers.dev/?url=https://example.com', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://unauthorized-evil-site.com'
      }
    });

    const res = await worker.fetch(req);
    expect(res.status).toBe(403);
  });

  it('rejects GET requests from unauthorized origins', async () => {
    const req = new Request('https://proxy.workers.dev/?url=https://example.com', {
      method: 'GET',
      headers: {
        Origin: 'https://unauthorized-evil-site.com'
      }
    });

    const res = await worker.fetch(req);
    expect(res.status).toBe(403);
  });

  it('proxies GET requests and calculates stream byte transfer', async () => {
    const mockTargetContent = 'Hello Moby Dick '.repeat(100);

    // Mock global fetch for worker target fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(
      new Response(mockTargetContent, {
        status: 200,
        headers: { 'Content-Type': 'text/plain', 'Content-Length': String(mockTargetContent.length) }
      })
    );

    try {
      const req = new Request('https://proxy.workers.dev/?url=https://www.gutenberg.org/cache/epub/2701/pg2701.txt', {
        method: 'GET',
        headers: {
          Origin: 'https://rogerallen.github.io'
        }
      });

      const res = await worker.fetch(req);
      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://rogerallen.github.io');

      const bodyText = await res.text();
      expect(bodyText).toBe(mockTargetContent);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('Zenolet Client Proxy Selection (fetchWithProxyFallback)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('strictly uses the custom proxy setting without public fallbacks when proxyUrlSetting is provided', async () => {
    const customProxy = 'https://custom-worker.workers.dev';
    const targetUrl = 'https://www.gutenberg.org/cache/epub/2701/pg2701.txt';

    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('custom-worker.workers.dev')) {
        return new Response('Moby Dick Full Content Here... '.repeat(10), { status: 200 });
      }
      return new Response('Failed', { status: 500 });
    });

    const result = await fetchWithProxyFallback(targetUrl, customProxy);

    expect(result).toContain('Moby Dick Full Content Here...');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toContain('custom-worker.workers.dev');
  });

  it('hard fails immediately if proxyUrlSetting is missing', async () => {
    const targetUrl = 'https://www.gutenberg.org/cache/epub/2701/pg2701.txt';
    await expect(fetchWithProxyFallback(targetUrl, undefined)).rejects.toThrow('Hard fail');
  });

  it('hard fails immediately if Cloudflare Worker proxy returns 500 or network error', async () => {
    const customProxy = 'https://custom-worker.workers.dev';
    const targetUrl = 'https://www.gutenberg.org/cache/epub/2701/pg2701.txt';

    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return new Response('Internal Proxy Error', { status: 500, statusText: 'Internal Server Error' });
    });

    await expect(fetchWithProxyFallback(targetUrl, customProxy)).rejects.toThrow('Hard fail');
  });
});

describe('getGutenbergCandidateUrls & fetchArrayBufferWithProxy', () => {
  it('prioritizes EPUB3 candidate URLs in getGutenbergCandidateUrls', async () => {
    const { getGutenbergCandidateUrls } = await import('./corsProxy.ts');
    const candidates = getGutenbergCandidateUrls('2701');
    expect(candidates[0]).toBe('https://www.gutenberg.org/ebooks/2701.epub3.images');
    expect(candidates[1]).toBe('https://www.gutenberg.org/cache/epub/2701/pg2701-images-3.epub');
    expect(candidates).toContain('https://www.gutenberg.org/cache/epub/2701/pg2701-images.html');
  });

  it('fetches binary ArrayBuffer through proxy via fetchArrayBufferWithProxy', async () => {
    const { fetchArrayBufferWithProxy } = await import('./corsProxy.ts');
    const customProxy = 'https://custom-worker.workers.dev';
    const targetUrl = 'https://www.gutenberg.org/ebooks/2701.epub3.images';

    const dummyBinary = new Uint8Array([
      80, 75, 3, 4, 10, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22,
      23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50
    ]);

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(dummyBinary.buffer, {
        status: 200,
        headers: { 'Content-Type': 'application/epub+zip' }
      })
    );

    const buffer = await fetchArrayBufferWithProxy(targetUrl, customProxy);
    expect(buffer.byteLength).toBe(dummyBinary.byteLength);
  });
});
