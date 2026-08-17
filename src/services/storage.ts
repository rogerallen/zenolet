// --- Storage & Offline Service for Zenolet ---

export interface BookMetadata {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  epubUrl?: string;
  htmlUrl?: string;
}

export interface BookDetails {
  metadata: BookMetadata;
  content: string;
}

export const BOOK_CACHE_NAME = 'zenolet-books-v1';
export const NUM_SLOTS = 8;
export const STORAGE_KEY_SLOTS = 'zenolet-slots';

export function getStoredSlots(): (BookMetadata | null)[] {
  const raw = localStorage.getItem(STORAGE_KEY_SLOTS);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const slots: (BookMetadata | null)[] = new Array(NUM_SLOTS).fill(null);
        for (let i = 0; i < NUM_SLOTS; i++) {
          slots[i] = parsed[i] || null;
        }
        return slots;
      }
    } catch (e) {
      console.error('[Zenolet Storage] Failed to parse stored slots:', e);
    }
  }

  // Check legacy zenolet-offline-metadata for migration if slots not set yet
  const legacy = localStorage.getItem('zenolet-offline-metadata');
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as BookMetadata[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const migrated: (BookMetadata | null)[] = new Array(NUM_SLOTS).fill(null);
        for (let i = 0; i < Math.min(NUM_SLOTS, parsed.length); i++) {
          migrated[i] = parsed[i];
        }
        localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(migrated));
        return migrated;
      }
    } catch {
      // Ignore legacy parsing errors
    }
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
  localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(normalized));

  // Keep zenolet-offline-metadata in sync for legacy compatibility
  const nonNull = normalized.filter((b): b is BookMetadata => b !== null);
  localStorage.setItem('zenolet-offline-metadata', JSON.stringify(nonNull));
}

export async function saveBookToSlot(slotIndex: number, book: BookMetadata, data: BookDetails): Promise<void> {
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
  // Clear previous slot if book already existed in another slot
  for (let i = 0; i < NUM_SLOTS; i++) {
    if (i !== slotIndex && slots[i]?.id === book.id) {
      slots[i] = null;
    }
  }
  if (slotIndex >= 0 && slotIndex < NUM_SLOTS) {
    slots[slotIndex] = book;
  }
  saveSlots(slots);
}

export async function removeBookFromSlot(slotIndex: number): Promise<void> {
  const slots = getStoredSlots();
  if (slotIndex >= 0 && slotIndex < NUM_SLOTS) {
    const book = slots[slotIndex];
    if (book) {
      if (typeof caches !== 'undefined') {
        const cacheUrl = `/cached-books/${encodeURIComponent(book.id)}`;
        try {
          const cache = await caches.open(BOOK_CACHE_NAME);
          await cache.delete(cacheUrl);
        } catch (e) {
          console.warn('[Zenolet PWA] Cache delete error:', e);
        }
      }
      clearBookProgress(book.id);
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
      slots[existingIdx] = null;
      slots[targetSlotIndex] = book;
    } else {
      // Keep in existing slot without moving
      slots[existingIdx] = book;
    }
  } else if (typeof targetSlotIndex === 'number' && targetSlotIndex >= 0 && targetSlotIndex < NUM_SLOTS) {
    slots[targetSlotIndex] = book;
  } else {
    // Assign to first empty slot
    const emptyIdx = slots.findIndex((s) => s === null);
    if (emptyIdx !== -1) {
      slots[emptyIdx] = book;
    } else {
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

export async function removeBookOffline(bookId: string): Promise<void> {
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

  const slots = getStoredSlots();
  for (let i = 0; i < NUM_SLOTS; i++) {
    if (slots[i]?.id === bookId) {
      slots[i] = null;
    }
  }
  saveSlots(slots);
}

export function getDownloadedMetadataList(): BookMetadata[] {
  const slots = getStoredSlots();
  return slots.filter((b): b is BookMetadata => b !== null);
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

export function clearBookProgress(bookId: string): void {
  if (saveProgressTimeout) clearTimeout(saveProgressTimeout);
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
