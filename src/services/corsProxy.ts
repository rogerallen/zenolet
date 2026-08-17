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
  } catch (_) {
    return `${baseProxy}?url=${encodeURIComponent(targetUrl)}`;
  }
}

export function getGutenbergCandidateUrls(bookId: string, rawHtmlUrl?: string): string[] {
  const candidates: string[] = [];

  candidates.push(`https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}-images.html`);
  candidates.push(`https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.html`);
  candidates.push(`https://www.gutenberg.org/files/${bookId}/${bookId}-h/${bookId}-h.htm`);

  if (rawHtmlUrl && !candidates.includes(rawHtmlUrl)) {
    candidates.push(rawHtmlUrl);
  }

  return candidates;
}

/**
 * Fetches content strictly using the Cloudflare Worker CORS proxy.
 * Hard fails immediately if proxy is unconfigured, unreachable, or returns a non-OK HTTP status.
 * No public fallbacks or direct connection retries.
 */
export async function fetchWithProxyFallback(targetUrl: string, proxyUrlSetting?: string): Promise<string> {
  if (!proxyUrlSetting) {
    const errorMsg = '[Zenolet CORS] Hard fail: No Cloudflare CORS Proxy URL configured in settings.';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const proxiedUrl = buildProxyUrl(targetUrl, proxyUrlSetting);
  console.log(`[Zenolet CORS] Fetching strictly via Cloudflare Proxy: "${proxiedUrl}" for target: "${targetUrl}"`);

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

  const text = await res.text();
  if (!text || text.length <= 200) {
    const errorMsg = `[Zenolet CORS] Hard fail: Received invalid or empty content (${text ? text.length : 0} bytes) from Cloudflare Proxy.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const mbSize = (text.length / (1024 * 1024)).toFixed(2);
  console.log(
    `[Zenolet CORS] Successfully downloaded ${text.length} chars (~${mbSize} MB) from "${targetUrl}" via Cloudflare Proxy.`
  );
  return text;
}

export function processBookHtml(rawHtml: string, bookSourceUrl: string, proxyUrlSetting?: string): string {
  if (typeof DOMParser === 'undefined') return rawHtml;
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  doc.querySelectorAll('script, style, iframe, header, footer').forEach((node) => node.remove());

  let baseUrlStr = bookSourceUrl;
  const lastSlashIndex = baseUrlStr.lastIndexOf('/');
  if (lastSlashIndex !== -1) {
    baseUrlStr = baseUrlStr.substring(0, lastSlashIndex + 1);
  }

  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src) {
      try {
        img.removeAttribute('width');
        img.removeAttribute('height');
        img.style.maxWidth = '100%';
        img.style.maxHeight = 'calc(100vh - 160px)';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';

        // 1. Keep data URLs as-is
        if (src.startsWith('data:')) {
          return;
        }

        // 2. Prevent double-proxying if already proxied
        if (proxyUrlSetting && src.startsWith(proxyUrlSetting)) {
          return;
        }
        if (src.includes('?url=')) {
          return;
        }

        // 3. Resolve relative image paths against book baseUrl
        let absUrl = src;
        if (!src.startsWith('http://') && !src.startsWith('https://')) {
          absUrl = new URL(src, baseUrlStr).toString();
        }
        const proxiedSrc = buildProxyUrl(absUrl, proxyUrlSetting);
        img.setAttribute('src', proxiedSrc);
      } catch (err) {
        console.warn('[Zenolet Image] Resolution error for src:', src, err);
      }
    }
  });

  return doc.body ? doc.body.innerHTML : rawHtml;
}

export async function cacheBookImagesOffline(processedHtml: string, proxyUrlSetting?: string): Promise<string> {
  if (typeof DOMParser === 'undefined') return processedHtml;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(processedHtml, 'text/html');
    const images = Array.from(doc.querySelectorAll('img'));
    if (images.length === 0) return processedHtml;

    let hasChanges = false;
    const BATCH_SIZE = 4;
    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (img) => {
          const src = img.getAttribute('src');
          if (src && !src.startsWith('data:')) {
            let targetUrl = src;
            if (src.includes('?url=')) {
              const parts = src.split('?url=');
              targetUrl = decodeURIComponent(parts[1] || parts[0]);
            }
            try {
              const proxiedUrl = buildProxyUrl(targetUrl, proxyUrlSetting);
              const response = await fetch(proxiedUrl);
              if (response.ok) {
                const blob = await response.blob();
                const arrayBuf = await blob.arrayBuffer();
                const bytes = new Uint8Array(arrayBuf);
                let binary = '';
                const len = bytes.byteLength;
                for (let b = 0; b < len; b++) {
                  binary += String.fromCharCode(bytes[b]);
                }
                const base64 = btoa(binary);
                const mimeType = blob.type || 'image/jpeg';
                const dataUrl = `data:${mimeType};base64,${base64}`;
                img.setAttribute('src', dataUrl);
                hasChanges = true;
              }
            } catch (imgErr) {
              console.warn('[Zenolet Image Cache] Failed to cache image:', src, imgErr);
            }
          }
        })
      );
    }
    return hasChanges && doc.body ? doc.body.innerHTML : processedHtml;
  } catch (err) {
    console.warn('[Zenolet Image Cache] Error caching book images:', err);
    return processedHtml;
  }
}
