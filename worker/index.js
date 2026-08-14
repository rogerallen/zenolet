// Cloudflare Worker CORS Proxy Script for Zenolet
// Designed for https://rogerallen.github.io/zenolet with support for local dev & Tailscale domains.

const ALLOWED_EXACT_ORIGINS = new Set([
  'https://rogerallen.github.io',
  'https://rogerallen.github.io/zenolet'
]);

/**
 * Validates whether the incoming Origin is allowed to use this CORS proxy.
 */
function isOriginAllowed(origin) {
  // Allow direct non-browser requests (e.g. curl, server-to-server, wrangler tail)
  if (!origin) return true;

  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true;

  try {
    const url = new URL(origin);
    const host = url.hostname;

    // GitHub Pages domain
    if (host === 'rogerallen.github.io') return true;

    // Local development environments
    if (host === 'localhost' || host === '127.0.0.1') return true;

    // Tailscale network domains (*.ts.net)
    if (host.endsWith('.ts.net')) return true;
  } catch (_) {}

  return false;
}

/**
 * Returns standard CORS headers tailored to the requesting origin.
 */
function getCorsHeaders(origin) {
  const allowedOrigin = (origin && isOriginAllowed(origin))
    ? origin
    : 'https://rogerallen.github.io';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, User-Agent, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Range',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');

    // 1. Preflight OPTIONS Handling
    if (request.method === 'OPTIONS') {
      if (origin && !isOriginAllowed(origin)) {
        console.warn(`[Zenolet Proxy] Rejected OPTIONS preflight from origin: ${origin}`);
        return new Response('Forbidden: Origin not allowed', { status: 403 });
      }
      console.log(`[Zenolet Proxy] Handled OPTIONS preflight for origin: ${origin || 'direct'}`);
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin)
      });
    }

    // 2. Enforce Origin Security on GET/HEAD
    if (origin && !isOriginAllowed(origin)) {
      console.warn(`[Zenolet Proxy] Rejected ${request.method} from origin: ${origin}`);
      return new Response('Forbidden: Origin not allowed', {
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 3. Extract & Validate Target URL
    const targetUrl = new URL(request.url).searchParams.get('url');
    if (!targetUrl) {
      return new Response('Missing ?url= parameter', {
        status: 400,
        headers: getCorsHeaders(origin)
      });
    }

    console.log(`[Zenolet Proxy] ${request.method} request for: "${targetUrl}" | Origin: "${origin || 'direct'}"`);

    try {
      // 4. Fetch Target Resource
      const response = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Zenolet/1.0 (Cloudflare Worker Proxy)' }
      });

      const responseHeaders = new Headers(response.headers);
      const corsHeaders = getCorsHeaders(origin);
      for (const [key, val] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, val);
      }

      const contentLength = response.headers.get('content-length');
      console.log(
        `[Zenolet Proxy] Target response received for "${targetUrl}" | ` +
        `Status: ${response.status} | Content-Type: ${response.headers.get('content-type') || 'unknown'} | ` +
        `Content-Length: ${contentLength ? contentLength + ' bytes' : 'unknown/chunked'}`
      );

      // Handle responses without body or HEAD requests
      if (!response.body || request.method === 'HEAD') {
        return new Response(null, {
          status: response.status,
          headers: responseHeaders
        });
      }

      // 5. Wrap stream with byte counter to verify full delivery
      let totalBytes = 0;
      const loggingStream = new TransformStream({
        transform(chunk, controller) {
          totalBytes += chunk.byteLength;
          controller.enqueue(chunk);
        },
        flush() {
          const sizeMB = (totalBytes / (1024 * 1024)).toFixed(2);
          console.log(
            `[Zenolet Proxy] Download complete for "${targetUrl}" | ` +
            `Total Bytes Transferred: ${totalBytes} bytes (${sizeMB} MB)`
          );
        }
      });

      const bodyStream = response.body.pipeThrough(loggingStream);

      return new Response(bodyStream, {
        status: response.status,
        headers: responseHeaders
      });
    } catch (err) {
      console.error(`[Zenolet Proxy] Error fetching "${targetUrl}": ${err.message}`);
      const errHeaders = getCorsHeaders(origin);
      errHeaders['Content-Type'] = 'text/plain';
      return new Response(`Proxy error: ${err.message}`, {
        status: 500,
        headers: errHeaders
      });
    }
  }
};
