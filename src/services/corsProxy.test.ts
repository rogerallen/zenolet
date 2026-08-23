import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore
import worker from '../../worker/index.js';
import { buildProxyUrl, getGutenbergCandidateUrls, fetchArrayBufferWithProxy } from './corsProxy.ts';

describe('buildProxyUrl URL Parsing', () => {
  it('correctly constructs proxied URLs for localhost proxy endpoints', () => {
    const target = 'https://www.gutenberg.org/ebooks/245.epub3.images';
    const proxy = 'http://localhost:8787';
    const result = buildProxyUrl(target, proxy);
    expect(result).toBe('http://localhost:8787/?url=https%3A%2F%2Fwww.gutenberg.org%2Febooks%2F245.epub3.images');
  });

  it('correctly constructs proxied URLs for Cloudflare workers.dev endpoints', () => {
    const target = 'https://www.gutenberg.org/ebooks/245.epub3.images';
    const proxy = 'https://zenolet-cors-proxy.rallen-e12.workers.dev';
    const result = buildProxyUrl(target, proxy);
    expect(result).toBe(
      'https://zenolet-cors-proxy.rallen-e12.workers.dev/?url=https%3A%2F%2Fwww.gutenberg.org%2Febooks%2F245.epub3.images'
    );
  });

  it('correctly constructs proxied URLs when proxy ends with ?url=', () => {
    const target = 'https://example.com/book.epub';
    const proxy = 'http://localhost:8787/?url=';
    const result = buildProxyUrl(target, proxy);
    expect(result).toBe('http://localhost:8787/?url=https%3A%2F%2Fexample.com%2Fbook.epub');
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

  it('handles OPTIONS preflight request for custom domain via env.ALLOWED_ORIGIN', async () => {
    const req = new Request('https://proxy.workers.dev/?url=https://example.com', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://my-server.ts.net'
      }
    });

    const res = await worker.fetch(req, { ALLOWED_ORIGIN: 'https://my-server.ts.net' });
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

  it('allows custom domain specified via env.ALLOWED_ORIGIN', async () => {
    const req = new Request('https://proxy.workers.dev/?url=https://example.com', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://my-custom-library.org'
      }
    });

    const res = await worker.fetch(req, { ALLOWED_ORIGIN: 'https://my-custom-library.org' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://my-custom-library.org');
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

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue(
      new Response(mockTargetContent, {
        status: 200,
        headers: { 'Content-Type': 'application/epub+zip', 'Content-Length': String(mockTargetContent.length) }
      })
    );

    try {
      const req = new Request('https://proxy.workers.dev/?url=https://www.gutenberg.org/ebooks/2701.epub3.images', {
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

  it('rejects proxy requests targeting non-Gutenberg domains with 403 Forbidden', async () => {
    const req = new Request('https://proxy.workers.dev/?url=https://evil-site.com/exploit.epub', {
      method: 'GET',
      headers: {
        Origin: 'https://rogerallen.github.io'
      }
    });

    const res = await worker.fetch(req);
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text).toContain('Only Project Gutenberg resources may be proxied');
  });

  it('rejects proxy requests targeting non-HTTP protocols with 403 Forbidden', async () => {
    const req = new Request('https://proxy.workers.dev/?url=file:///etc/passwd', {
      method: 'GET',
      headers: {
        Origin: 'https://rogerallen.github.io'
      }
    });

    const res = await worker.fetch(req);
    expect(res.status).toBe(403);
  });

  it('rejects malformed target URLs with 400 Bad Request', async () => {
    const req = new Request('https://proxy.workers.dev/?url=not-a-valid-url', {
      method: 'GET',
      headers: {
        Origin: 'https://rogerallen.github.io'
      }
    });

    const res = await worker.fetch(req);
    expect(res.status).toBe(400);
  });
});

describe('getGutenbergCandidateUrls & fetchArrayBufferWithProxy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prioritizes static cache EPUB candidate URLs and custom URLs exclusively', () => {
    const candidates = getGutenbergCandidateUrls('2701', 'https://www.gutenberg.org/custom-2701.epub');
    expect(candidates[0]).toBe('https://www.gutenberg.org/custom-2701.epub');
    expect(candidates[1]).toBe('https://www.gutenberg.org/cache/epub/2701/pg2701-images.epub');
    expect(candidates[2]).toBe('https://www.gutenberg.org/cache/epub/2701/pg2701-images-3.epub');
    expect(candidates[3]).toBe('https://www.gutenberg.org/cache/epub/2701/pg2701.epub');
    // Ensure no legacy raw HTML URLs are returned
    expect(candidates.some((c) => c.endsWith('.html') || c.endsWith('.htm'))).toBe(false);
  });

  it('fetches binary ArrayBuffer through proxy via fetchArrayBufferWithProxy', async () => {
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

  it('hard fails immediately if proxyUrlSetting is missing', async () => {
    const targetUrl = 'https://www.gutenberg.org/ebooks/2701.epub3.images';
    await expect(fetchArrayBufferWithProxy(targetUrl, undefined)).rejects.toThrow('Hard fail');
  });

  it('hard fails immediately if Cloudflare Worker proxy returns 500 or network error', async () => {
    const customProxy = 'https://custom-worker.workers.dev';
    const targetUrl = 'https://www.gutenberg.org/ebooks/2701.epub3.images';

    vi.spyOn(global, 'fetch').mockImplementation(async () => {
      return new Response('Internal Proxy Error', { status: 500, statusText: 'Internal Server Error' });
    });

    await expect(fetchArrayBufferWithProxy(targetUrl, customProxy)).rejects.toThrow('Hard fail');
  });
});
