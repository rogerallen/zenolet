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
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 800, right: 1000, bottom: 800, x: 0, y: 0, toJSON: () => {} })
    } as unknown as HTMLDivElement;

    const mockEl1 = {
      getBoundingClientRect: () => ({ left: 37050, top: 50, width: 400, height: 40, right: 37450, bottom: 90, x: 37050, y: 50, toJSON: () => {} })
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
      expect(mockOpen).toHaveBeenCalledWith('zenolet-books-v1');
      expect(mockDelete).toHaveBeenCalledWith('/cached-books/1342');
    } finally {
      // @ts-ignore
      delete globalThis.caches;
    }
  });
});
