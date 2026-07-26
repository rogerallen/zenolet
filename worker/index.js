// Cloudflare Worker CORS Proxy Script for Zenolet
export default {
  async fetch(request) {
    const targetUrl = new URL(request.url).searchParams.get('url');
    if (!targetUrl) {
      return new Response('Missing ?url= parameter', { status: 400 });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Zenolet/1.0' }
      });

      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      return new Response(response.body, {
        status: response.status,
        headers: headers
      });
    } catch (err) {
      return new Response(`Proxy error: ${err.message}`, { status: 500 });
    }
  }
};
