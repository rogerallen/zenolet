import { describe, it, expect, beforeEach } from 'vitest';
import { recalculatePages, type ReaderState } from './ReaderEngine.js';

describe('ReaderEngine recalculatePages & DOM scroll preservation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not restore stale DOM scroll and stays on page 1 when preserveDOMScroll is false', () => {
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });
    Object.defineProperty(mockViewport, 'scrollWidth', { value: 5000, configurable: true });
    mockViewport.scrollLeft = 0;

    const mockContent = document.createElement('div') as HTMLElement;
    Object.defineProperty(mockContent, 'scrollWidth', { value: 5000, configurable: true });

    const mockSnapPoints = document.createElement('div') as HTMLDivElement;
    const mockProgressFill = document.createElement('div') as HTMLDivElement;
    const mockPageIndicator = document.createElement('span') as HTMLSpanElement;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 0,
      totalPagesSpreads: 10
    };

    mockViewport.scrollLeft = 0; // Simulate openBook resetting scrollLeft before recalculate

    recalculatePages(
      mockViewport,
      mockContent,
      mockSnapPoints,
      mockProgressFill,
      mockPageIndicator,
      state,
      '2701',
      false // preserveDOMScroll: false
    );

    expect(mockViewport.scrollLeft).toBe(0);
    expect(state.currentPageSpread).toBe(0);
    expect(mockProgressFill.style.width).toBe('0%');
  });

  it('preserves and restores DOM scroll position when preserveDOMScroll is true on resize/settings change', () => {
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });
    Object.defineProperty(mockViewport, 'scrollWidth', { value: 5000, configurable: true });
    mockViewport.scrollLeft = 2250; // 50% of (5000 - 500 = 4500) maxScroll

    const mockContent = document.createElement('div') as HTMLElement;
    Object.defineProperty(mockContent, 'scrollWidth', { value: 5000, configurable: true });

    const mockSnapPoints = document.createElement('div') as HTMLDivElement;
    const mockProgressFill = document.createElement('div') as HTMLDivElement;
    const mockPageIndicator = document.createElement('span') as HTMLSpanElement;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 0,
      totalPagesSpreads: 10
    };

    recalculatePages(
      mockViewport,
      mockContent,
      mockSnapPoints,
      mockProgressFill,
      mockPageIndicator,
      state,
      '2701',
      true // preserveDOMScroll: true
    );

    // Target scroll = 0.5 * 4500 = 2250 -> targetSpread = Math.round(2250 / 500) = 5 -> 5 * 500 = 2500
    expect(mockViewport.scrollLeft).toBe(2500);
  });
});
