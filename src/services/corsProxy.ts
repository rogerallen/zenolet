export function buildProxyUrl(targetUrl: string, proxyUrlSetting?: string): string {
  if (!targetUrl) return '';
  // If targetUrl is local or relative, return as is
  if (targetUrl.startsWith('/') || targetUrl.startsWith(window.location.origin)) {
    return targetUrl;
  }

  const baseProxy = proxyUrlSetting || 'https://corsproxy.io/?';

  if (baseProxy.includes('workers.dev')) {
    // Cloudflare Worker format: https://worker.dev/?url=ENCODED
    const workerUrl = new URL(baseProxy);
    workerUrl.searchParams.set('url', targetUrl);
    return workerUrl.toString();
  } else if (baseProxy.endsWith('?')) {
    // corsproxy.io style: https://corsproxy.io/?URL
    return `${baseProxy}${encodeURIComponent(targetUrl)}`;
  } else {
    return `${baseProxy}${encodeURIComponent(targetUrl)}`;
  }
}

export function getGutenbergCandidateUrls(bookId: string, rawHtmlUrl?: string): string[] {
  const candidates: string[] = [];

  // Direct CDN paths (bypasses 302 redirects like ebooks/1695.html.images)
  candidates.push(`https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}-images.html`);
  candidates.push(`https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.html`);
  candidates.push(`https://www.gutenberg.org/files/${bookId}/${bookId}-h/${bookId}-h.htm`);

  if (rawHtmlUrl && !candidates.includes(rawHtmlUrl)) {
    candidates.push(rawHtmlUrl);
  }

  return candidates;
}
