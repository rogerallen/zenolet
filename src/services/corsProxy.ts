export function buildProxyUrl(targetUrl: string, proxyUrlSetting?: string): string {
  if (!targetUrl) return '';
  if (targetUrl.startsWith('/') || targetUrl.startsWith(window.location.origin)) {
    return targetUrl;
  }

  const baseProxy = proxyUrlSetting || 'https://corsproxy.io/?';

  if (baseProxy.includes('workers.dev')) {
    const workerUrl = new URL(baseProxy);
    workerUrl.searchParams.set('url', targetUrl);
    return workerUrl.toString();
  } else if (baseProxy.endsWith('?')) {
    return `${baseProxy}${encodeURIComponent(targetUrl)}`;
  } else {
    return `${baseProxy}${encodeURIComponent(targetUrl)}`;
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

export async function fetchWithProxyFallback(
  targetUrl: string,
  proxyUrlSetting?: string
): Promise<string> {
  const proxies: string[] = [];

  if (proxyUrlSetting) {
    proxies.push(proxyUrlSetting);
  }
  if (!proxies.includes('https://corsproxy.io/?')) proxies.push('https://corsproxy.io/?');
  proxies.push('https://api.allorigins.win/raw?url=');
  proxies.push('https://api.codetabs.com/v1/proxy?quest=');

  let lastStatus = 0;

  for (const proxy of proxies) {
    const proxiedUrl = buildProxyUrl(targetUrl, proxy);
    try {
      const res = await fetch(proxiedUrl);
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 200) {
          return text;
        }
      }
      lastStatus = res.status;
    } catch (_) {}
  }

  try {
    const directRes = await fetch(targetUrl);
    if (directRes.ok) {
      const text = await directRes.text();
      if (text && text.length > 200) return text;
    }
  } catch (_) {}

  throw new Error(`Proxy status: ${lastStatus}`);
}

export function processBookHtml(
  rawHtml: string,
  bookSourceUrl: string,
  proxyUrlSetting?: string
): string {
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
        let absUrl = src;
        if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
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
