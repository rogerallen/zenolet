/**
 * Builds the proxied URL using strictly the Cloudflare Worker CORS proxy.
 * Hard fails if no proxy URL setting is provided.
 */
export function buildProxyUrl(targetUrl: string, proxyUrlSetting?: string): string {
  if (!targetUrl) return '';
  if (targetUrl.startsWith('/') || targetUrl.startsWith(window.location.origin)) {
    return targetUrl;
  }

  if (!proxyUrlSetting) {
    throw new Error('[Zenolet CORS] Cloudflare CORS Proxy URL is not configured. Hard fail.');
  }

  const baseProxy = proxyUrlSetting.trim();

  if (baseProxy.endsWith('?') || baseProxy.endsWith('=')) {
    return `${baseProxy}${encodeURIComponent(targetUrl)}`;
  }

  try {
    const workerUrl = new URL(baseProxy);
    workerUrl.searchParams.set('url', targetUrl);
    return workerUrl.toString();
  } catch {
    return `${baseProxy}?url=${encodeURIComponent(targetUrl)}`;
  }
}

/**
 * Returns prioritized Project Gutenberg EPUB candidate URLs for a book.
 */
export function getGutenbergCandidateUrls(bookId: string, customEpubUrl?: string): string[] {
  const candidates: string[] = [];

  // 1. Custom EPUB URL provided by catalog (if any)
  if (customEpubUrl) {
    candidates.push(customEpubUrl);
  }

  // 2. Static CDN cache endpoints (most reliable and fast)
  candidates.push(`https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}-images.epub`);
  candidates.push(`https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}-images-3.epub`);
  candidates.push(`https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.epub`);

  // 3. Dynamic generation endpoints (fallback)
  candidates.push(`https://www.gutenberg.org/ebooks/${bookId}.epub3.images`);
  candidates.push(`https://www.gutenberg.org/ebooks/${bookId}.epub.images`);

  return [...new Set(candidates)];
}

/**
 * Fetches binary ArrayBuffer content strictly using the Cloudflare Worker CORS proxy.
 * Hard fails immediately if proxy is unconfigured, unreachable, or returns a non-OK HTTP status.
 */
export async function fetchArrayBufferWithProxy(targetUrl: string, proxyUrlSetting?: string): Promise<ArrayBuffer> {
  if (!proxyUrlSetting) {
    const errorMsg = '[Zenolet CORS] Hard fail: No Cloudflare CORS Proxy URL configured in settings.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const proxiedUrl = buildProxyUrl(targetUrl, proxyUrlSetting);
  console.log(`[Zenolet CORS] Fetching binary via Cloudflare Proxy: "${proxiedUrl}" for target: "${targetUrl}"`);

  let res: Response;
  try {
    res = await fetch(proxiedUrl);
  } catch (err) {
    const errorMsg = `[Zenolet CORS] Hard fail: Cloudflare Worker proxy connection error: ${err instanceof Error ? err.message : String(err)}`;
    console.error(errorMsg);
    throw new Error(errorMsg, { cause: err });
  }

  if (!res.ok) {
    const errorMsg = `[Zenolet CORS] Hard fail: Cloudflare Worker proxy returned HTTP status ${res.status} ${res.statusText}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const buffer = await res.arrayBuffer();
  if (!buffer || buffer.byteLength < 50) {
    const errorMsg = `[Zenolet CORS] Hard fail: Received invalid or empty binary content (${buffer ? buffer.byteLength : 0} bytes) from Cloudflare Proxy.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const mbSize = (buffer.byteLength / (1024 * 1024)).toFixed(2);
  console.log(
    `[Zenolet CORS] Successfully downloaded binary ${buffer.byteLength} bytes (~${mbSize} MB) from "${targetUrl}" via Cloudflare Proxy.`
  );
  return buffer;
}
