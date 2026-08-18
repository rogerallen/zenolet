export interface AppState {
  bookId: string;
  progress: number; // 0.0 to 1.0
  theme?: string; // 'paper' | 'sepia' | 'charcoal' | 'night'
  fontSize?: number;
}

// Encode state into compressed URL hash: #s=...
export async function encodeState(state: AppState): Promise<string> {
  const jsonStr = JSON.stringify(state);

  if (typeof CompressionStream !== 'undefined') {
    try {
      const bodyStream = new Response(jsonStr).body;
      if (bodyStream) {
        const stream = bodyStream.pipeThrough(new CompressionStream('deflate-raw'));
        const buffer = await new Response(stream).arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');
        return `#s=${base64}`;
      }
    } catch (err) {
      console.warn('[Zenolet State] CompressionStream failed, fallback to base64:', err);
    }
  }

  // Fallback encoding if CompressionStream unavailable
  const uncompressedBase64 = btoa(encodeURIComponent(jsonStr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `#s=u_${uncompressedBase64}`;
}

// Decode state from URL hash: #s=...
export async function decodeState(hash: string): Promise<AppState | null> {
  if (!hash || !hash.startsWith('#s=')) return null;
  const rawPayload = hash.slice(3);
  if (!rawPayload) return null;

  // Uncompressed fallback check
  if (rawPayload.startsWith('u_')) {
    try {
      let base64 = rawPayload.slice(2).replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
      const jsonStr = decodeURIComponent(atob(base64));
      return JSON.parse(jsonStr) as AppState;
    } catch (err) {
      console.error('[Zenolet State] Failed to decode uncompressed state URL:', err);
      return null;
    }
  }

  // Standard deflate-raw decompression
  try {
    let base64 = rawPayload.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    if (typeof DecompressionStream !== 'undefined') {
      const bodyStream = new Response(bytes).body;
      if (bodyStream) {
        const stream = bodyStream.pipeThrough(new DecompressionStream('deflate-raw'));
        const jsonStr = await new Response(stream).text();
        return JSON.parse(jsonStr) as AppState;
      }
    }

    console.warn('[Zenolet State] DecompressionStream not supported in this browser.');
    return null;
  } catch (err) {
    console.error('[Zenolet State] Failed to decode compressed state URL:', err);
    return null;
  }
}
