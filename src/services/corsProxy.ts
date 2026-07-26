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
