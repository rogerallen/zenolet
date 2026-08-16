import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-ignore
import worker from '../../worker/index.js';
import { buildProxyUrl, fetchWithProxyFallback } from './corsProxy.ts';

describe('buildProxyUrl URL Parsing', () => {
  it('correctly constructs proxied URLs for localhost proxy endpoints', () => {
    const target = 'https://www.gutenberg.org/cache/epub/245/pg245-images.html';
    const proxy = 'http://localhost:8787';
    const result = buildProxyUrl(target, proxy);
    expect(result).toBe('http://localhost:8787/?url=https%3A%2F%2Fwww.gutenberg.org%2Fcache%2Fepub%2F245%2Fpg245-images.html');
  });

  it('correctly constructs proxied URLs for Cloudflare workers.dev endpoints', () => {
    const target = 'https://www.gutenberg.org/cache/epub/245/pg245-images.html';
    const proxy = 'https://zenolet-cors-proxy.rallen-e12.workers.dev';
    const result = buildProxyUrl(target, proxy);
    expect(result).toBe('https://zenolet-cors-proxy.rallen-e12.workers.dev/?url=https%3A%2F%2Fwww.gutenberg.org%2Fcache%2Fepub%2F245%2Fpg245-images.html');
  });

  it('correctly constructs proxied URLs when proxy ends with ?url=', () => {
    const target = 'https://example.com';
    const proxy = 'http://localhost:8787/?url=';
    const result = buildProxyUrl(target, proxy);
    expect(result).toBe('http://localhost:8787/?url=https%3A%2F%2Fexample.com');
  });
});

describe('Worker Proxy Security & CORS Preflight', () => {
  it('handles OPTIONS preflight request for allowed GitHub Pages origin', async () => {
    const req = new Request('https://proxy.workers.dev/?url=https://example.com', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://rogerallen.github.io'
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
        'Origin': 'http://localhost:5173'
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
        'Origin': 'https://my-server.ts.net'
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
        'Origin': 'https://unauthorized-evil-site.com'
      }
    });

    const res = await worker.fetch(req);
    expect(res.status).toBe(403);
  });

  it('rejects GET requests from unauthorized origins', async () => {
    const req = new Request('https://proxy.workers.dev/?url=https://example.com', {
      method: 'GET',
      headers: {
        'Origin': 'https://unauthorized-evil-site.com'
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
          'Origin': 'https://rogerallen.github.io'
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
