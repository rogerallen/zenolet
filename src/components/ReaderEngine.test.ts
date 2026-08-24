import { describe, it, expect, beforeEach } from 'vitest';
import { recalculatePages, type ReaderState } from './ReaderEngine.js';
import { clearBookProgress } from '../services/storage.js';

describe('ReaderEngine recalculatePages & DOM scroll preservation', () => {
  beforeEach(() => {
    localStorage.clear();
    clearBookProgress();
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
    expect(state.currentPageSpread).toBe(5);
    expect(mockPageIndicator.textContent).toBe('Page 6 of 10');
    expect(mockProgressFill.style.width).not.toBe('0%');
  });

  it('correctly calculates two-column spreads and indicators', () => {
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(mockViewport, 'scrollWidth', { value: 10000, configurable: true });
    mockViewport.scrollLeft = 0;

    const mockContent = document.createElement('div') as HTMLElement;
    Object.defineProperty(mockContent, 'scrollWidth', { value: 10000, configurable: true });

    const mockSnapPoints = document.createElement('div') as HTMLDivElement;
    const mockProgressFill = document.createElement('div') as HTMLDivElement;
    const mockPageIndicator = document.createElement('span') as HTMLSpanElement;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'sepia',
      fontSize: 18,
      layoutColumns: '2',
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
      false
    );

    expect(mockContent.classList.contains('two-columns')).toBe(true);
    expect(mockPageIndicator.textContent).toContain('Pages 1–2 of 20');
  });

  it('correctly calculates three-column spreads and indicators', () => {
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 1500, configurable: true });
    Object.defineProperty(mockViewport, 'scrollWidth', { value: 15000, configurable: true });
    mockViewport.scrollLeft = 0;

    const mockContent = document.createElement('div') as HTMLElement;
    Object.defineProperty(mockContent, 'scrollWidth', { value: 15000, configurable: true });

    const mockSnapPoints = document.createElement('div') as HTMLDivElement;
    const mockProgressFill = document.createElement('div') as HTMLDivElement;
    const mockPageIndicator = document.createElement('span') as HTMLSpanElement;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '3',
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
      false
    );

    expect(mockContent.classList.contains('three-columns')).toBe(true);
    expect(mockContent.style.columnWidth).toBe('500px');
    expect(mockPageIndicator.textContent).toContain('Pages 1–3 of 30');
  });

  it('auto-switches columns based on window.innerWidth breakpoints in auto mode', () => {
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 1000, configurable: true });
    Object.defineProperty(mockViewport, 'scrollWidth', { value: 10000, configurable: true });
    mockViewport.scrollLeft = 0;

    const mockContent = document.createElement('div') as HTMLElement;
    Object.defineProperty(mockContent, 'scrollWidth', { value: 10000, configurable: true });

    const mockSnapPoints = document.createElement('div') as HTMLDivElement;
    const mockProgressFill = document.createElement('div') as HTMLDivElement;
    const mockPageIndicator = document.createElement('span') as HTMLSpanElement;

    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: 'auto',
      currentPageSpread: 0,
      totalPagesSpreads: 10
    };

    // 1. Large screen (>= 1500px) -> 3 columns
    Object.defineProperty(window, 'innerWidth', { value: 1920, configurable: true });
    recalculatePages(
      mockViewport,
      mockContent,
      mockSnapPoints,
      mockProgressFill,
      mockPageIndicator,
      state,
      '2701',
      false
    );
    expect(mockContent.classList.contains('three-columns')).toBe(true);

    // 2. Medium screen (768px < w < 1500px) -> 2 columns
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
    recalculatePages(
      mockViewport,
      mockContent,
      mockSnapPoints,
      mockProgressFill,
      mockPageIndicator,
      state,
      '2701',
      false
    );
    expect(mockContent.classList.contains('two-columns')).toBe(true);

    // 3. Mobile screen (<= 768px) -> 1 column
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    recalculatePages(
      mockViewport,
      mockContent,
      mockSnapPoints,
      mockProgressFill,
      mockPageIndicator,
      state,
      '2701',
      false
    );
    expect(mockContent.classList.contains('one-column')).toBe(true);
  });

  it('uses cached chapter markers during active chapter updates without layout thrashing (PER-001)', async () => {
    const { updateActiveChapterLabel, invalidateChapterMarkers } = await import('./Timeline.js');

    const mockContent = document.createElement('div') as HTMLElement;
    mockContent.innerHTML = `
      <h2 id="ch1">Chapter 1</h2>
      <p>Content 1</p>
      <h2 id="ch2">Chapter 2</h2>
      <p>Content 2</p>
    `;

    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });

    const indicator = document.createElement('span');
    indicator.id = 'active-chapter-indicator';
    document.body.appendChild(indicator);

    try {
      invalidateChapterMarkers();
      updateActiveChapterLabel(mockContent, mockViewport, 0, 10);
      expect(indicator.textContent).toBe('Begin');

      updateActiveChapterLabel(mockContent, mockViewport, 9, 10);
      expect(indicator.textContent).toBe('End');

      updateActiveChapterLabel(mockContent, mockViewport, 3, 10);
      expect(indicator.textContent).toBeTruthy();
    } finally {
      indicator.remove();
    }
  });

  it('does not trigger debounced saveBookProgress when skipSaveProgress is true (COR-002)', async () => {
    const { getStoredProgress, flushBookProgress } = await import('../services/storage.js');
    localStorage.setItem(
      'zenolet-reading-progress',
      JSON.stringify({ '2701': { progressFraction: 0.85, lastReadTime: Date.now() } })
    );

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

    recalculatePages(
      mockViewport,
      mockContent,
      mockSnapPoints,
      mockProgressFill,
      mockPageIndicator,
      state,
      '2701',
      false,
      true // skipSaveProgress: true
    );

    // Ensure flushing debounced progress does NOT overwrite saved 0.85 with 0
    flushBookProgress();
    expect(getStoredProgress('2701')).toBe(0.85);
  });

  it('safely handles localStorage.setItem exceptions in setTheme, setFontSize, and setLayoutColumns (REL-002)', async () => {
    const { setTheme, setFontSize, setLayoutColumns } = await import('./ReaderEngine.js');
    const state: ReaderState = {
      currentView: 'reader',
      theme: 'paper',
      fontSize: 18,
      layoutColumns: '1',
      currentPageSpread: 0,
      totalPagesSpreads: 10
    };

    const originalSetItem = localStorage.setItem;
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };

    try {
      expect(() => setTheme('sepia', state)).not.toThrow();
      expect(state.theme).toBe('sepia');

      expect(() => setFontSize(22, state, () => {})).not.toThrow();
      expect(state.fontSize).toBe(22);

      expect(() => setLayoutColumns('2', state, () => {})).not.toThrow();
      expect(state.layoutColumns).toBe('2');
    } finally {
      localStorage.setItem = originalSetItem;
    }
  });
});
