// Cloudflare Worker CORS Proxy Script for Zenolet
// Designed for static deployments (GitHub Pages, Cloudflare Pages, Netlify, Vercel) with support for local dev & Tailscale domains.

// Custom allowed origins for your deployment (optional)
const ALLOWED_ORIGINS = [
  // 'https://<your-username>.github.io',
  // 'https://my-custom-domain.com'
];

/**
 * Validates whether the incoming Origin is allowed to use this CORS proxy.
 */
function isOriginAllowed(origin, env) {
  // Allow direct non-browser requests (e.g. curl, server-to-server, wrangler tail)
  if (!origin) return true;

  // Check in-code ALLOWED_ORIGINS list
  if (Array.isArray(ALLOWED_ORIGINS) && ALLOWED_ORIGINS.includes(origin)) return true;

  // Check Cloudflare Worker environment variables (single origin or comma-separated)
  if (env && env.ALLOWED_ORIGIN) {
    const envOrigins = env.ALLOWED_ORIGIN.split(',').map((o) => o.trim());
    if (envOrigins.includes(origin)) return true;
  }

  try {
    const url = new URL(origin);
    const host = url.hostname;

    // Local development environments
    if (host === 'localhost' || host === '127.0.0.1') return true;

    // Static hosting platforms
    if (
      host.endsWith('.github.io') ||
      host.endsWith('.pages.dev') ||
      host.endsWith('.netlify.app') ||
      host.endsWith('.vercel.app')
    ) {
      return true;
    }

    // Tailscale network domains (*.ts.net)
    if (host.endsWith('.ts.net')) return true;
  } catch {
    // Ignore URL parse failures
  }

  return false;
}

/**
 * Returns standard CORS headers tailored to the requesting origin.
 */
function getCorsHeaders(origin, env) {
  const allowedOrigin = origin && isOriginAllowed(origin, env) ? origin : '*';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, User-Agent, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Content-Range',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');

    // 1. Preflight OPTIONS Handling
    if (request.method === 'OPTIONS') {
      if (origin && !isOriginAllowed(origin, env)) {
        console.warn(`[Zenolet Proxy] Rejected OPTIONS preflight from origin: ${origin}`);
        return new Response('Forbidden: Origin not allowed', { status: 403 });
      }
      console.log(`[Zenolet Proxy] Handled OPTIONS preflight for origin: ${origin || 'direct'}`);
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(origin, env)
      });
    }

    // 2. Enforce Origin Security on GET/HEAD
    if (origin && !isOriginAllowed(origin, env)) {
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
        headers: getCorsHeaders(origin, env)
      });
    }

    let parsedTargetUrl;
    try {
      parsedTargetUrl = new URL(targetUrl);
    } catch {
      return new Response('Invalid ?url= parameter', {
        status: 400,
        headers: getCorsHeaders(origin, env)
      });
    }

    if (parsedTargetUrl.protocol !== 'https:' && parsedTargetUrl.protocol !== 'http:') {
      return new Response('Forbidden: Only HTTP/HTTPS URLs are permitted', {
        status: 403,
        headers: getCorsHeaders(origin, env)
      });
    }

    const targetHost = parsedTargetUrl.hostname.toLowerCase();
    const isAllowedHost = targetHost === 'gutenberg.org' || targetHost.endsWith('.gutenberg.org');
    if (!isAllowedHost) {
      console.warn(`[Zenolet Proxy] Rejected proxy request for non-Gutenberg host: "${targetHost}"`);
      return new Response('Forbidden: Target host not allowed. Only Project Gutenberg resources may be proxied.', {
        status: 403,
        headers: getCorsHeaders(origin, env)
      });
    }

    console.log(`[Zenolet Proxy] ${request.method} request for: "${targetUrl}" | Origin: "${origin || 'direct'}"`);

    try {
      // 4. Fetch Target Resource
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (Zenolet CORS Proxy)',
          Accept: 'application/epub+zip,image/*,*/*'
        },
        redirect: 'follow'
      });

      const responseHeaders = new Headers(response.headers);
      const corsHeaders = getCorsHeaders(origin, env);
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
      const errHeaders = getCorsHeaders(origin, env);
      errHeaders['Content-Type'] = 'text/plain';
      return new Response(`Proxy error: ${err.message}`, {
        status: 500,
        headers: errHeaders
      });
    }
  }
};
