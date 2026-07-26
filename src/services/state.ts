export interface AppState {
  bookId: string;
  progress: number; // 0.0 to 1.0
  theme?: string;   // 'paper' | 'sepia' | 'charcoal' | 'night'
  fontSize?: number;
}

// Encode state into compressed URL hash: #s=...
export async function encodeState(state: AppState): Promise<string> {
  const jsonStr = JSON.stringify(state);
  
  if (typeof CompressionStream !== 'undefined') {
    try {
      const stream = new Blob([jsonStr]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const buffer = await new Response(stream).arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      return `#s=${base64}`;
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
      const base64 = rawPayload.slice(2).replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = decodeURIComponent(atob(base64));
      return JSON.parse(jsonStr) as AppState;
    } catch (err) {
      console.error('[Zenolet State] Failed to decode uncompressed state URL:', err);
      return null;
    }
  }

  // Standard deflate-raw decompression
  try {
    const base64 = rawPayload.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      const jsonStr = await new Response(stream).text();
      return JSON.parse(jsonStr) as AppState;
    } else {
      console.warn('[Zenolet State] DecompressionStream not supported in this browser.');
      return null;
    }
  } catch (err) {
    console.error('[Zenolet State] Failed to decode compressed state URL:', err);
    return null;
  }
}
