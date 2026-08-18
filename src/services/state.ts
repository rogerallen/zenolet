import { deflateSync, inflateSync, strToU8, strFromU8 } from 'fflate';

export interface AppState {
  bookId: string;
  progress: number; // 0.0 to 1.0
  theme?: string; // 'paper' | 'sepia' | 'charcoal' | 'night'
  fontSize?: number;
}

// Encode state into compressed URL hash: #s=...
export async function encodeState(state: AppState): Promise<string> {
  try {
    const jsonStr = JSON.stringify(state);
    const bytes = strToU8(jsonStr);
    const compressed = deflateSync(bytes);
    let binary = '';
    const len = compressed.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(compressed[i]);
    }
    const base64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `#s=${base64}`;
  } catch (err) {
    console.warn('[Zenolet State] fflate compression failed, fallback to base64:', err);
    const jsonStr = JSON.stringify(state);
    const uncompressedBase64 = btoa(encodeURIComponent(jsonStr))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `#s=u_${uncompressedBase64}`;
  }
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

  // Standard deflate-raw decompression via fflate
  try {
    let base64 = rawPayload.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decompressed = inflateSync(bytes);
    const jsonStr = strFromU8(decompressed);
    return JSON.parse(jsonStr) as AppState;
  } catch (err) {
    console.error('[Zenolet State] Failed to decode compressed state URL:', err);
    return null;
  }
}
