import { describe, it, expect, beforeEach } from 'vitest';
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

  it('saves and reads offline metadata correctly in localStorage', () => {
    const mockBooks = [
      { id: '1661', title: 'Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle' },
      { id: '11', title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll' }
    ];

    localStorage.setItem('zenolet-offline-metadata', JSON.stringify(mockBooks));

    const retrievedRaw = localStorage.getItem('zenolet-offline-metadata');
    expect(retrievedRaw).not.toBeNull();
    const retrieved = JSON.parse(retrievedRaw!);
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].title).toBe('Adventures of Sherlock Holmes');
  });
});
