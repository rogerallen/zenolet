import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getElementSpreadIndex } from '../components/Timeline.js';

describe('Storage and Progress Math for Zenolet', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('calculates stored progress fraction correctly based on scrollLeft and maxScroll', () => {
    const mockViewport = {
      scrollWidth: 1000,
      clientWidth: 200,
      scrollLeft: 400
    } as unknown as HTMLDivElement;

    const maxScroll = mockViewport.scrollWidth - mockViewport.clientWidth;
    const progressFraction = maxScroll > 0 ? mockViewport.scrollLeft / maxScroll : 0;

    expect(maxScroll).toBe(800);
    expect(progressFraction).toBe(0.5);
  });

  it('calculates target scroll spread correctly from progress fraction', () => {
    const fraction = 0.5;
    const mockViewport = {
      scrollWidth: 2000,
      clientWidth: 400
    };
    const maxScroll = mockViewport.scrollWidth - mockViewport.clientWidth;
    const targetScroll = fraction * maxScroll;
    const targetSpread = Math.round(targetScroll / mockViewport.clientWidth);

    expect(targetScroll).toBe(800);
    expect(targetSpread).toBe(2);
  });

  it('updates current page spread index dynamically as scroll position changes', () => {
    const totalPagesSpreads = 10;
    const pageWidth = 500;

    const getSpread = (scrollLeft: number) =>
      Math.min(totalPagesSpreads - 1, Math.max(0, Math.round(scrollLeft / pageWidth)));

    expect(getSpread(0)).toBe(0);
    expect(getSpread(500)).toBe(1);
    expect(getSpread(1000)).toBe(2);
    expect(getSpread(1500)).toBe(3);
    expect(getSpread(4500)).toBe(9);
  });

  it('correctly maps elements on both left and right pages using getBoundingClientRect', () => {
    const totalSpreads = 100;
    const pageWidth = 1000;

    const mockViewport = {
      clientWidth: pageWidth,
      scrollLeft: 0,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 1000,
        height: 800,
        right: 1000,
        bottom: 800,
        x: 0,
        y: 0,
        toJSON: () => {}
      })
    } as unknown as HTMLDivElement;

    const mockEl1 = {
      getBoundingClientRect: () => ({
        left: 37050,
        top: 50,
        width: 400,
        height: 40,
        right: 37450,
        bottom: 90,
        x: 37050,
        y: 50,
        toJSON: () => {}
      })
    } as unknown as HTMLElement;
    expect(getElementSpreadIndex(mockEl1, mockViewport, totalSpreads)).toBe(37);
  });

  it('returns 8 empty null slots by default without starter books', async () => {
    const { getStoredSlots } = await import('./storage.js');
    const slots = getStoredSlots();
    expect(slots).toHaveLength(8);
    expect(slots.every((s) => s === null)).toBe(true);
  });

  it('preserves exact slot positions when updating or removing books', async () => {
    const { getStoredSlots, saveSlots, removeBookFromSlot } = await import('./storage.js');
    const mockBookA = { id: '84', title: 'Frankenstein', author: 'Mary Shelley' };
    const mockBookB = { id: '2701', title: 'Moby Dick', author: 'Herman Melville' };

    const initialSlots = new Array(8).fill(null);
    initialSlots[1] = mockBookA;
    initialSlots[5] = mockBookB;
    saveSlots(initialSlots);

    const loaded = getStoredSlots();
    expect(loaded[0]).toBeNull();
    expect(loaded[1]?.id).toBe('84');
    expect(loaded[5]?.id).toBe('2701');

    // Remove book in Slot 1
    await removeBookFromSlot(1);
    const afterRemoval = getStoredSlots();
    expect(afterRemoval[1]).toBeNull();
    expect(afterRemoval[5]?.id).toBe('2701'); // Slot 5 still in Slot 5, not shifted!
  });

  it('resets reading progress when a book is removed from a slot', async () => {
    const { saveSlots, removeBookFromSlot, getStoredProgress } = await import('./storage.js');
    const mockBook = { id: '84', title: 'Frankenstein', author: 'Mary Shelley' };
    const slots = new Array(8).fill(null);
    slots[2] = mockBook;
    saveSlots(slots);

    // Simulate stored progress for Frankenstein
    localStorage.setItem(
      'zenolet-reading-progress',
      JSON.stringify({ '84': { progressFraction: 0.65, lastReadTime: Date.now() } })
    );
    expect(getStoredProgress('84')).toBe(0.65);

    // Remove book from slot 2
    await removeBookFromSlot(2);

    // Progress must be reset / null so next time it starts on page 1
    expect(getStoredProgress('84')).toBeNull();
  });

  it('purges cached offline book content and images from Cache API on removal', async () => {
    const { saveSlots, removeBookFromSlot } = await import('./storage.js');
    const mockBook = { id: '1342', title: 'Pride and Prejudice', author: 'Jane Austen' };
    const slots = new Array(8).fill(null);
    slots[3] = mockBook;
    saveSlots(slots);

    const mockDelete = vi.fn().mockResolvedValue(true);
    const mockCache = { delete: mockDelete, put: vi.fn(), match: vi.fn() };
    const mockOpen = vi.fn().mockResolvedValue(mockCache);

    // @ts-ignore
    globalThis.caches = { open: mockOpen, delete: vi.fn(), has: vi.fn(), keys: vi.fn(), match: vi.fn() };

    try {
      await removeBookFromSlot(3);
      expect(mockOpen).toHaveBeenCalledWith('zenolet-books-v2');
      expect(mockDelete).toHaveBeenCalledWith('/cached-books/1342');
    } finally {
      // @ts-ignore
      delete globalThis.caches;
    }
  });

  it('purges replaced book cache and progress when saving over an occupied slot (COR-001)', async () => {
    const { saveSlots, saveBookOffline, getStoredProgress } = await import('./storage.js');
    const oldBook = { id: '84', title: 'Frankenstein', author: 'Mary Shelley' };
    const newBook = { id: '2701', title: 'Moby Dick', author: 'Herman Melville' };

    const slots = new Array(8).fill(null);
    slots[2] = oldBook;
    saveSlots(slots);

    localStorage.setItem(
      'zenolet-reading-progress',
      JSON.stringify({ '84': { progressFraction: 0.5, lastReadTime: Date.now() } })
    );

    const mockDelete = vi.fn().mockResolvedValue(true);
    const mockPut = vi.fn().mockResolvedValue(undefined);
    const mockCache = { delete: mockDelete, put: mockPut, match: vi.fn() };
    const mockOpen = vi.fn().mockResolvedValue(mockCache);

    // @ts-ignore
    globalThis.caches = { open: mockOpen, delete: vi.fn(), has: vi.fn(), keys: vi.fn(), match: vi.fn() };

    try {
      await saveBookOffline(newBook, { metadata: newBook, content: '<p>Whale</p>' }, 2);
      expect(mockOpen).toHaveBeenCalledWith('zenolet-books-v2');
      expect(mockDelete).toHaveBeenCalledWith('/cached-books/84');
      expect(mockPut).toHaveBeenCalledWith('/cached-books/2701', expect.anything());
      expect(getStoredProgress('84')).toBeNull();
    } finally {
      // @ts-ignore
      delete globalThis.caches;
    }
  });

  it('purges Slot 0 cache when saving to a full shelf without a target slot (COR-001)', async () => {
    const { saveSlots, saveBookOffline, getStoredSlots } = await import('./storage.js');
    const fullSlots = Array.from({ length: 8 }, (_, i) => ({
      id: `book-${i}`,
      title: `Title ${i}`,
      author: `Author ${i}`
    }));
    saveSlots(fullSlots);

    const incomingBook = { id: 'book-new', title: 'New Title', author: 'New Author' };

    const mockDelete = vi.fn().mockResolvedValue(true);
    const mockPut = vi.fn().mockResolvedValue(undefined);
    const mockCache = { delete: mockDelete, put: mockPut, match: vi.fn() };
    const mockOpen = vi.fn().mockResolvedValue(mockCache);

    // @ts-ignore
    globalThis.caches = { open: mockOpen, delete: vi.fn(), has: vi.fn(), keys: vi.fn(), match: vi.fn() };

    try {
      await saveBookOffline(incomingBook, { metadata: incomingBook, content: '<p>New</p>' }, null);
      expect(mockDelete).toHaveBeenCalledWith('/cached-books/book-0');
      expect(mockPut).toHaveBeenCalledWith('/cached-books/book-new', expect.anything());
      const updated = getStoredSlots();
      expect(updated[0]?.id).toBe('book-new');
      expect(updated[1]?.id).toBe('book-1');
    } finally {
      // @ts-ignore
      delete globalThis.caches;
    }
  });

  it('formats byte sizes into clean human-readable strings via formatBytes', async () => {
    const { formatBytes } = await import('./storage.js');
    expect(formatBytes(undefined)).toBe('');
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(512 * 1024)).toBe('512 KB');
    expect(formatBytes(2.2 * 1024 * 1024)).toBe('2.2 MB');
    expect(formatBytes(15.75 * 1024 * 1024)).toBe('15.8 MB');
  });

  it('formats library storage summary strings correctly via formatStorageSummary', async () => {
    const { formatStorageSummary } = await import('./storage.js');
    expect(formatStorageSummary(0, 0)).toBe('0 books, 0 MB used');
    expect(formatStorageSummary(1, 1.2 * 1024 * 1024)).toBe('1 book, 1.2 MB used');
    expect(formatStorageSummary(3, 3.8 * 1024 * 1024)).toBe('3 books, 3.8 MB used');
  });

  it('immediately flushes debounced reading progress on demand via flushBookProgress (COR-002)', async () => {
    const { saveBookProgress, flushBookProgress, getStoredProgress, getStoredProgressDetails } =
      await import('./storage.js');
    saveBookProgress('2701', 0.85, 4, 0.25);

    // Before timeout fires, calling flushBookProgress immediately persists to localStorage
    flushBookProgress('2701', 0.85, 4, 0.25);
    expect(getStoredProgress('2701')).toBe(0.85);

    const details = getStoredProgressDetails('2701');
    expect(details?.progressFraction).toBe(0.85);
    expect(details?.chapterIndex).toBe(4);
    expect(details?.chapterProgress).toBe(0.25);
  });

  it('safely normalizes NaN or out-of-range fractions in restoreBookProgressByFraction', async () => {
    const { restoreBookProgressByFraction } = await import('./storage.js');
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });
    Object.defineProperty(mockViewport, 'scrollWidth', { value: 5000, configurable: true });
    mockViewport.scrollLeft = 0;

    restoreBookProgressByFraction(NaN, mockViewport);
    expect(mockViewport.scrollLeft).toBe(0);

    restoreBookProgressByFraction(-0.5, mockViewport);
    expect(mockViewport.scrollLeft).toBe(0);

    restoreBookProgressByFraction(1.5, mockViewport);
    expect(mockViewport.scrollLeft).toBe(4500); // Max scroll = 5000 - 500 = 4500
  });

  it('estimates storage quota when navigator.storage.estimate is supported', async () => {
    const { getStorageQuotaEstimate } = await import('./storage.js');
    const originalNavigatorStorage = navigator.storage;

    try {
      // 1. Success case
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({ usage: 1048576, quota: 10485760 })
        },
        configurable: true
      });

      const estimate = await getStorageQuotaEstimate();
      expect(estimate).toEqual({ usage: 1048576, quota: 10485760 });

      // 2. Error case
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockRejectedValue(new Error('Permission denied'))
        },
        configurable: true
      });

      const failedEstimate = await getStorageQuotaEstimate();
      expect(failedEstimate).toBeNull();
    } finally {
      Object.defineProperty(navigator, 'storage', {
        value: originalNavigatorStorage,
        configurable: true
      });
    }
  });

  it('calculates actual storage usage with fallback to quota estimate when byteSize is 0', async () => {
    const { getActualStorageUsage, saveSlots } = await import('./storage.js');
    const originalNavigatorStorage = navigator.storage;

    try {
      // Save a book with byteSize = 0
      const slots = new Array(8).fill(null);
      slots[0] = {
        id: 'zero-size-book',
        title: 'Zero Size',
        author: 'Author',
        byteSize: 0
      };
      saveSlots(slots);

      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({ usage: 2097152, quota: 10485760 })
        },
        configurable: true
      });

      const usage = await getActualStorageUsage();
      expect(usage.bookCount).toBe(1);
      expect(usage.totalBytes).toBe(2097152);
    } finally {
      Object.defineProperty(navigator, 'storage', {
        value: originalNavigatorStorage,
        configurable: true
      });
    }
  });

  it('migrates legacy zenolet-offline-metadata into zenolet-slots', async () => {
    const { getStoredSlots } = await import('./storage.js');
    const legacyBooks = [
      { id: 'b1', title: 'Book 1', author: 'Author 1', byteSize: 100 },
      { id: 'b2', title: 'Book 2', author: 'Author 2', byteSize: 200 }
    ];

    localStorage.setItem('zenolet-offline-metadata', JSON.stringify(legacyBooks));

    const slots = getStoredSlots();
    expect(slots[0]?.id).toBe('b1');
    expect(slots[1]?.id).toBe('b2');
    expect(slots.slice(2).every((s) => s === null)).toBe(true);
  });

  it('safely handles corrupt JSON in localStorage slots and progress', async () => {
    const { getStoredSlots, getStoredProgressDetails } = await import('./storage.js');

    localStorage.setItem('zenolet-slots', '{corrupt json');
    const slots = getStoredSlots();
    expect(slots.length).toBe(8);
    expect(slots.every((s) => s === null)).toBe(true);

    localStorage.setItem('zenolet-reading-progress', 'not-valid-json');
    const progress = getStoredProgressDetails('any-book');
    expect(progress).toBeNull();
  });

  it('saves and retrieves offline book details via Cache API and moves existing slots', async () => {
    const { saveBookOffline, getStoredBookOffline, getStoredSlots, purgeBookCache } = await import('./storage.js');

    const fakeCacheStore = new Map<string, Response>();
    const fakeCache = {
      put: vi.fn(async (url: string, res: Response) => {
        fakeCacheStore.set(url, res.clone());
      }),
      match: vi.fn(async (url: string) => fakeCacheStore.get(url)?.clone() || null),
      delete: vi.fn(async (url: string) => fakeCacheStore.delete(url)),
      keys: vi.fn(async () => Array.from(fakeCacheStore.keys()).map((u) => new Request(u)))
    };

    // @ts-ignore
    globalThis.caches = {
      open: vi.fn(async () => fakeCache as unknown as Cache),
      delete: vi.fn(async () => true)
    } as unknown as CacheStorage;

    try {
      const bookMeta = { id: 'moby-offline', title: 'Moby Dick', author: 'Melville' };
      const bookData = { metadata: bookMeta, content: '<h1>Call me Ishmael</h1>' };

      // 1. Save book offline without target slot -> places in slot 0
      await saveBookOffline(bookMeta, bookData);
      expect(fakeCache.put).toHaveBeenCalled();

      const slotsAfterFirst = getStoredSlots();
      expect(slotsAfterFirst[0]?.id).toBe('moby-offline');

      // 2. Retrieve offline book
      const retrieved = await getStoredBookOffline('moby-offline');
      expect(retrieved?.metadata.title).toBe('Moby Dick');
      expect(retrieved?.content).toBe('<h1>Call me Ishmael</h1>');

      // 3. Move existing book to slot 3
      await saveBookOffline(bookMeta, bookData, 3);
      const slotsAfterMove = getStoredSlots();
      expect(slotsAfterMove[0]).toBeNull();
      expect(slotsAfterMove[3]?.id).toBe('moby-offline');

      // 4. Clean up
      await purgeBookCache('moby-offline');
      expect(fakeCache.delete).toHaveBeenCalled();
    } finally {
      // @ts-ignore
      delete globalThis.caches;
    }
  });

  it('calculates getStoredProgressFraction accurately based on viewport geometry', async () => {
    const { getStoredProgressFraction } = await import('./storage.js');
    const mockViewport = document.createElement('div') as HTMLDivElement;

    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });
    Object.defineProperty(mockViewport, 'scrollWidth', { value: 2500, configurable: true });
    mockViewport.scrollLeft = 1000;

    // maxScroll = 2500 - 500 = 2000; 1000 / 2000 = 0.5
    expect(getStoredProgressFraction(mockViewport)).toBe(0.5);

    // When scrollWidth equals clientWidth, maxScroll is 0
    Object.defineProperty(mockViewport, 'scrollWidth', { value: 500, configurable: true });
    expect(getStoredProgressFraction(mockViewport)).toBe(0);
  });
});
