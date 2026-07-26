// --- Storage & Offline Service for Zenolet ---

export interface BookMetadata {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  htmlUrl?: string;
}

export interface BookDetails {
  metadata: BookMetadata;
  content: string;
}

export const BOOK_CACHE_NAME = 'zenolet-books-v1';
export const MAX_OFFLINE_BOOKS = 10;

// --- Offline Book Storage (Cache API) ---
export async function saveBookOffline(book: BookMetadata, data: BookDetails): Promise<void> {
  const cacheUrl = `/cached-books/${encodeURIComponent(book.id)}`;
  const cache = await caches.open(BOOK_CACHE_NAME);
  const response = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
  await cache.put(cacheUrl, response);

  // Update metadata index list in localStorage
  const savedMeta = getDownloadedMetadataList();
  const filtered = savedMeta.filter((b) => b.id !== book.id);
  // Keep max 10
  if (filtered.length >= MAX_OFFLINE_BOOKS) {
    const evicted = filtered.shift();
    if (evicted) {
      await removeBookOffline(evicted.id);
    }
  }
  filtered.push(book);
  localStorage.setItem('zenolet-offline-metadata', JSON.stringify(filtered));
}

export async function getStoredBookOffline(bookId: string): Promise<BookDetails | null> {
  const cacheUrl = `/cached-books/${encodeURIComponent(bookId)}`;
  try {
    const cache = await caches.open(BOOK_CACHE_NAME);
    const cachedResponse = await cache.match(cacheUrl);
    if (cachedResponse) {
      return await cachedResponse.json();
    }
  } catch (e) {
    console.warn('[Zenolet PWA] Cache match failed:', e);
  }
  return null;
}

export async function removeBookOffline(bookId: string): Promise<void> {
  const cacheUrl = `/cached-books/${encodeURIComponent(bookId)}`;
  try {
    const cache = await caches.open(BOOK_CACHE_NAME);
    await cache.delete(cacheUrl);
  } catch (e) {
    console.warn('[Zenolet PWA] Cache delete error:', e);
  }

  const savedMeta = getDownloadedMetadataList();
  const updated = savedMeta.filter((b) => b.id !== bookId);
  localStorage.setItem('zenolet-offline-metadata', JSON.stringify(updated));
}

export function getDownloadedMetadataList(): BookMetadata[] {
  const savedMeta = localStorage.getItem('zenolet-offline-metadata');
  if (savedMeta) {
    try {
      return JSON.parse(savedMeta) as BookMetadata[];
    } catch (e) {
      console.error('[Zenolet PWA] Failed to parse offline metadata list:', e);
    }
  }
  return [];
}

export function getDownloadedBookSet(): Set<string> {
  const list = getDownloadedMetadataList();
  return new Set(list.map((b) => b.id));
}

// --- Reading Progress Storage (localStorage) ---
let saveProgressTimeout: ReturnType<typeof setTimeout> | null = null;

export function saveBookProgress(bookId: string, progressFraction: number): void {
  if (saveProgressTimeout) clearTimeout(saveProgressTimeout);
  saveProgressTimeout = setTimeout(() => {
    try {
      const progressMapRaw = localStorage.getItem('zenolet-reading-progress') || '{}';
      const progressMap = JSON.parse(progressMapRaw);
      progressMap[bookId] = {
        progressFraction,
        lastReadTime: Date.now()
      };
      localStorage.setItem('zenolet-reading-progress', JSON.stringify(progressMap));
    } catch (e) {
      console.error('[Progress] Failed to save reading progress:', e);
    }
  }, 300);
}

export function getStoredProgress(bookId: string): number | null {
  try {
    const progressMapRaw = localStorage.getItem('zenolet-reading-progress');
    if (!progressMapRaw) return null;
    const progressMap = JSON.parse(progressMapRaw);
    const item = progressMap[bookId];
    return item && typeof item.progressFraction === 'number' ? item.progressFraction : null;
  } catch (e) {
    return null;
  }
}

export function getStoredProgressFraction(viewport: HTMLDivElement): number {
  const maxScroll = viewport.scrollWidth - viewport.clientWidth;
  return maxScroll > 0 ? Math.min(1, Math.max(0, viewport.scrollLeft / maxScroll)) : 0;
}

export function restoreBookProgressByFraction(fraction: number, viewport: HTMLDivElement): void {
  const maxScroll = viewport.scrollWidth - viewport.clientWidth;
  if (maxScroll > 0) {
    const targetScroll = fraction * maxScroll;
    const pageWidth = viewport.clientWidth;
    const targetSpread = Math.round(targetScroll / pageWidth);

    const originalStyle = viewport.style.scrollBehavior;
    viewport.style.scrollBehavior = 'auto';
    viewport.scrollLeft = targetSpread * pageWidth;

    // Force reflow
    viewport.getBoundingClientRect();
    viewport.style.scrollBehavior = originalStyle;
  }
}
