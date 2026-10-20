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
  const activeBooks = getStoredBooks();
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

import type { EpubChapter, ParsedChapter } from './epub.js';

export interface BookDetails {
  metadata: BookMetadata;
  chapters?: ParsedChapter[];
  tocChapters?: EpubChapter[];
  content?: string;
}

export const BOOK_CACHE_NAME = 'zenolet-books-v2';
export const NUM_SLOTS = 8;
export const STORAGE_KEY_SLOTS = 'zenolet-slots';

export function getStoredBooks(): BookMetadata[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SLOTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is BookMetadata =>
            item !== null && typeof item === 'object' && typeof item.id === 'string' && item.id.length > 0
        );
      }
    }

    // Check legacy zenolet-offline-metadata for migration if slots not set yet
    const legacy = localStorage.getItem('zenolet-offline-metadata');
    if (legacy) {
      const parsed = JSON.parse(legacy) as BookMetadata[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const nonNull = parsed.filter(
          (item): item is BookMetadata =>
            item !== null && typeof item === 'object' && typeof item.id === 'string' && item.id.length > 0
        );
        localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(nonNull));
        return nonNull;
      }
    }
  } catch (e) {
    console.error('[Zenolet Storage] Failed to read stored books:', e);
  }

  return [];
}

export function getStoredSlots(): (BookMetadata | null)[] {
  return getStoredBooks();
}

export function saveBooks(books: BookMetadata[]): void {
  const nonNull = books.filter(
    (b): b is BookMetadata => b !== null && typeof b === 'object' && typeof b.id === 'string' && b.id.length > 0
  );
  try {
    localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(nonNull));
    localStorage.setItem('zenolet-offline-metadata', JSON.stringify(nonNull));
  } catch (e) {
    console.error('[Zenolet Storage] Failed to save books to localStorage:', e);
  }
}

export function saveSlots(slots: (BookMetadata | null)[]): void {
  const nonNull = slots.filter(
    (b): b is BookMetadata => b !== null && typeof b === 'object' && typeof b.id === 'string' && b.id.length > 0
  );
  saveBooks(nonNull);
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
  const books = getStoredBooks();
  if (slotIndex >= 0 && slotIndex < books.length) {
    const book = books[slotIndex];
    if (book) {
      await purgeBookCache(book.id);
    }
    books.splice(slotIndex, 1);
    saveBooks(books);
  }
}

export async function removeBookFromBookshelf(bookId: string): Promise<void> {
  await purgeBookCache(bookId);
  const books = getStoredBooks();
  const updated = books.filter((b) => b.id !== bookId);
  saveBooks(updated);
}

// --- Offline Book Storage (Cache API) ---
export async function saveBookOffline(
  book: BookMetadata,
  data: BookDetails,
  targetSlotIndex?: number | null
): Promise<void> {
  if (!book.byteSize) {
    const rawContent = data.content || (data.chapters || []).map((c) => c.htmlContent).join('');
    try {
      book.byteSize = new Blob([rawContent]).size;
    } catch {
      book.byteSize = rawContent.length;
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

  const books = getStoredBooks();
  const existingIdx = books.findIndex((s) => s.id === book.id);

  if (existingIdx !== -1) {
    // Keep in existing position, updating metadata
    books[existingIdx] = book;
  } else if (typeof targetSlotIndex === 'number' && targetSlotIndex >= 0 && targetSlotIndex < books.length) {
    const overwrittenBook = books[targetSlotIndex];
    if (overwrittenBook && overwrittenBook.id !== book.id) {
      await purgeBookCache(overwrittenBook.id);
    }
    books[targetSlotIndex] = book;
  } else {
    // Append to end of dynamic bookshelf
    books.push(book);
  }
  saveBooks(books);
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
export interface StoredReadingProgress {
  progressFraction: number;
  chapterIndex?: number;
  chapterProgress?: number;
  lastReadTime: number;
}

let saveProgressTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingSave: {
  bookId: string;
  progressFraction: number;
  chapterIndex?: number;
  chapterProgress?: number;
} | null = null;

export function flushBookProgress(
  bookId?: string,
  progressFraction?: number,
  chapterIndex?: number,
  chapterProgress?: number
): void {
  if (saveProgressTimeout) {
    clearTimeout(saveProgressTimeout);
    saveProgressTimeout = null;
  }

  const targetBookId = bookId || pendingSave?.bookId;
  const targetFraction = typeof progressFraction === 'number' ? progressFraction : pendingSave?.progressFraction;
  const targetChapterIndex = typeof chapterIndex === 'number' ? chapterIndex : pendingSave?.chapterIndex;
  const targetChapterProgress = typeof chapterProgress === 'number' ? chapterProgress : pendingSave?.chapterProgress;

  if (targetBookId && typeof targetFraction === 'number') {
    try {
      const progressMapRaw = localStorage.getItem('zenolet-reading-progress') || '{}';
      const progressMap = JSON.parse(progressMapRaw);
      progressMap[targetBookId] = {
        progressFraction: targetFraction,
        chapterIndex: typeof targetChapterIndex === 'number' ? targetChapterIndex : undefined,
        chapterProgress: typeof targetChapterProgress === 'number' ? targetChapterProgress : undefined,
        lastReadTime: Date.now()
      };
      localStorage.setItem('zenolet-reading-progress', JSON.stringify(progressMap));
    } catch (e) {
      console.error('[Progress] Failed to flush reading progress:', e);
    }
  }
  pendingSave = null;
}

export function saveBookProgress(
  bookId: string,
  progressFraction: number,
  chapterIndex?: number,
  chapterProgress?: number
): void {
  pendingSave = { bookId, progressFraction, chapterIndex, chapterProgress };
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

export function getStoredProgressDetails(bookId: string): StoredReadingProgress | null {
  try {
    const progressMapRaw = localStorage.getItem('zenolet-reading-progress');
    if (!progressMapRaw) return null;
    const progressMap = JSON.parse(progressMapRaw);
    const item = progressMap[bookId];
    return item && typeof item.progressFraction === 'number' ? (item as StoredReadingProgress) : null;
  } catch {
    return null;
  }
}

export function getStoredProgress(bookId: string): number | null {
  const details = getStoredProgressDetails(bookId);
  return details ? details.progressFraction : null;
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

/**
 * Requests persistent storage from the browser to protect cached books and reading progress
 * from eviction under disk space pressure or inactivity (e.g. iOS Safari ITP 7-day rule).
 * Returns true if persistence is granted, false otherwise.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Zenolet Storage] Persistent storage granted: ${isPersisted}`);
      return isPersisted;
    } catch (err) {
      console.warn('[Zenolet Storage] Failed to request persistent storage:', err);
      return false;
    }
  }
  return false;
}
