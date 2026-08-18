// --- Storage & Offline Service for Zenolet ---

export interface BookMetadata {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  epubUrl?: string;
  byteSize?: number;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function getStorageQuotaEstimate(): Promise<{ usage?: number; quota?: number } | null> {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
    try {
      const estimate = await navigator.storage.estimate();
      return { usage: estimate.usage, quota: estimate.quota };
    } catch {
      return null;
    }
  }
  return null;
}

export async function getActualStorageUsage(): Promise<{ bookCount: number; totalBytes: number }> {
  const slots = getStoredSlots();
  const activeBooks = slots.filter((s): s is BookMetadata => s !== null);
  const bookCount = activeBooks.length;
  let totalBytes = activeBooks.reduce((acc, s) => acc + (s.byteSize || 0), 0);

  if (totalBytes === 0 && bookCount > 0) {
    const estimate = await getStorageQuotaEstimate();
    if (estimate?.usage && estimate.usage > 0) {
      totalBytes = estimate.usage;
    }
  }

  return { bookCount, totalBytes };
}

export function formatStorageSummary(bookCount: number, totalBytes: number): string {
  const bookLabel = bookCount === 1 ? 'book' : 'books';
  const sizeFormatted = totalBytes > 0 ? formatBytes(totalBytes) : '0 MB';
  return `${bookCount} ${bookLabel}, ${sizeFormatted} used`;
}

import type { EpubChapter } from './epub.js';

export interface BookDetails {
  metadata: BookMetadata;
  content: string;
  chapters?: EpubChapter[];
}

export const BOOK_CACHE_NAME = 'zenolet-books-v1';
export const NUM_SLOTS = 8;
export const STORAGE_KEY_SLOTS = 'zenolet-slots';

export function getStoredSlots(): (BookMetadata | null)[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SLOTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const slots: (BookMetadata | null)[] = new Array(NUM_SLOTS).fill(null);
        for (let i = 0; i < NUM_SLOTS; i++) {
          slots[i] = parsed[i] || null;
        }
        return slots;
      }
    }

    // Check legacy zenolet-offline-metadata for migration if slots not set yet
    const legacy = localStorage.getItem('zenolet-offline-metadata');
    if (legacy) {
      const parsed = JSON.parse(legacy) as BookMetadata[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const migrated: (BookMetadata | null)[] = new Array(NUM_SLOTS).fill(null);
        for (let i = 0; i < Math.min(NUM_SLOTS, parsed.length); i++) {
          migrated[i] = parsed[i];
        }
        localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e) {
    console.error('[Zenolet Storage] Failed to read stored slots:', e);
  }

  // Default to 8 completely empty slots (no starter books)
  const emptySlots: (BookMetadata | null)[] = new Array(NUM_SLOTS).fill(null);
  return emptySlots;
}

export function saveSlots(slots: (BookMetadata | null)[]): void {
  const normalized: (BookMetadata | null)[] = new Array(NUM_SLOTS).fill(null);
  for (let i = 0; i < NUM_SLOTS; i++) {
    normalized[i] = slots[i] || null;
  }
  try {
    localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(normalized));
    // Keep zenolet-offline-metadata in sync for legacy compatibility
    const nonNull = normalized.filter((b): b is BookMetadata => b !== null);
    localStorage.setItem('zenolet-offline-metadata', JSON.stringify(nonNull));
  } catch (e) {
    console.error('[Zenolet Storage] Failed to save slots to localStorage:', e);
  }
}

export async function purgeBookCache(bookId: string): Promise<void> {
  if (typeof caches !== 'undefined') {
    const cacheUrl = `/cached-books/${encodeURIComponent(bookId)}`;
    try {
      const cache = await caches.open(BOOK_CACHE_NAME);
      await cache.delete(cacheUrl);
    } catch (e) {
      console.warn('[Zenolet PWA] Cache delete error:', e);
    }
  }
  clearBookProgress(bookId);
}

export async function removeBookFromSlot(slotIndex: number): Promise<void> {
  const slots = getStoredSlots();
  if (slotIndex >= 0 && slotIndex < NUM_SLOTS) {
    const book = slots[slotIndex];
    if (book) {
      await purgeBookCache(book.id);
    }
    slots[slotIndex] = null;
    saveSlots(slots);
  }
}

// --- Offline Book Storage (Cache API) ---
export async function saveBookOffline(
  book: BookMetadata,
  data: BookDetails,
  targetSlotIndex?: number | null
): Promise<void> {
  if (!book.byteSize && data.content) {
    try {
      book.byteSize = new Blob([data.content]).size;
    } catch {
      book.byteSize = data.content.length;
    }
  }

  const cacheUrl = `/cached-books/${encodeURIComponent(book.id)}`;
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(BOOK_CACHE_NAME);
      const response = new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
      await cache.put(cacheUrl, response);
    } catch (e) {
      console.warn('[Zenolet PWA] Cache put error:', e);
    }
  }

  const slots = getStoredSlots();
  const existingIdx = slots.findIndex((s) => s?.id === book.id);

  if (existingIdx !== -1) {
    // If targetSlotIndex specified and different from existing slot, move to target
    if (
      typeof targetSlotIndex === 'number' &&
      targetSlotIndex >= 0 &&
      targetSlotIndex < NUM_SLOTS &&
      targetSlotIndex !== existingIdx
    ) {
      const overwrittenBook = slots[targetSlotIndex];
      if (overwrittenBook && overwrittenBook.id !== book.id) {
        await purgeBookCache(overwrittenBook.id);
      }
      slots[existingIdx] = null;
      slots[targetSlotIndex] = book;
    } else {
      // Keep in existing slot without moving
      slots[existingIdx] = book;
    }
  } else if (typeof targetSlotIndex === 'number' && targetSlotIndex >= 0 && targetSlotIndex < NUM_SLOTS) {
    const overwrittenBook = slots[targetSlotIndex];
    if (overwrittenBook && overwrittenBook.id !== book.id) {
      await purgeBookCache(overwrittenBook.id);
    }
    slots[targetSlotIndex] = book;
  } else {
    // Assign to first empty slot
    const emptyIdx = slots.findIndex((s) => s === null);
    if (emptyIdx !== -1) {
      slots[emptyIdx] = book;
    } else {
      // Full shelf: overwrite Slot 0 and purge old Slot 0 book
      const overwrittenBook = slots[0];
      if (overwrittenBook && overwrittenBook.id !== book.id) {
        await purgeBookCache(overwrittenBook.id);
      }
      slots[0] = book;
    }
  }
  saveSlots(slots);
}

export async function getStoredBookOffline(bookId: string): Promise<BookDetails | null> {
  if (typeof caches === 'undefined') return null;
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

// --- Reading Progress Storage (localStorage) ---
let saveProgressTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSave: { bookId: string; progressFraction: number } | null = null;

export function flushBookProgress(bookId?: string, progressFraction?: number): void {
  if (saveProgressTimeout) {
    clearTimeout(saveProgressTimeout);
    saveProgressTimeout = null;
  }

  const targetBookId = bookId || pendingSave?.bookId;
  const targetFraction = typeof progressFraction === 'number' ? progressFraction : pendingSave?.progressFraction;

  if (targetBookId && typeof targetFraction === 'number') {
    try {
      const progressMapRaw = localStorage.getItem('zenolet-reading-progress') || '{}';
      const progressMap = JSON.parse(progressMapRaw);
      progressMap[targetBookId] = {
        progressFraction: targetFraction,
        lastReadTime: Date.now()
      };
      localStorage.setItem('zenolet-reading-progress', JSON.stringify(progressMap));
    } catch (e) {
      console.error('[Progress] Failed to flush reading progress:', e);
    }
  }
  pendingSave = null;
}

export function saveBookProgress(bookId: string, progressFraction: number): void {
  pendingSave = { bookId, progressFraction };
  if (saveProgressTimeout) clearTimeout(saveProgressTimeout);
  saveProgressTimeout = setTimeout(() => {
    flushBookProgress();
  }, 300);
}

export function clearBookProgress(bookId?: string): void {
  if (!bookId || pendingSave?.bookId === bookId) {
    pendingSave = null;
  }
  if (saveProgressTimeout) {
    clearTimeout(saveProgressTimeout);
    saveProgressTimeout = null;
  }
  if (bookId) {
    try {
      const progressMapRaw = localStorage.getItem('zenolet-reading-progress');
      if (progressMapRaw) {
        const progressMap = JSON.parse(progressMapRaw);
        if (progressMap[bookId]) {
          delete progressMap[bookId];
          localStorage.setItem('zenolet-reading-progress', JSON.stringify(progressMap));
        }
      }
    } catch (e) {
      console.error('[Progress] Failed to clear reading progress:', e);
    }
  }
}

export function getStoredProgress(bookId: string): number | null {
  try {
    const progressMapRaw = localStorage.getItem('zenolet-reading-progress');
    if (!progressMapRaw) return null;
    const progressMap = JSON.parse(progressMapRaw);
    const item = progressMap[bookId];
    return item && typeof item.progressFraction === 'number' ? item.progressFraction : null;
  } catch {
    return null;
  }
}

export function getStoredProgressFraction(viewport: HTMLDivElement): number {
  const maxScroll = viewport.scrollWidth - viewport.clientWidth;
  return maxScroll > 0 ? Math.min(1, Math.max(0, viewport.scrollLeft / maxScroll)) : 0;
}

export function restoreBookProgressByFraction(fraction: number, viewport: HTMLDivElement): void {
  const safeFraction = Math.min(1, Math.max(0, isNaN(fraction) ? 0 : fraction));
  const maxScroll = viewport.scrollWidth - viewport.clientWidth;
  if (maxScroll > 0) {
    const targetScroll = safeFraction * maxScroll;
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
