import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getChapterMarkers,
  updateActiveChapterLabel,
  resolveChapterElement,
  getElementSpreadIndex,
  invalidateChapterMarkers,
  closeChapterPopup
} from './Timeline.js';
import type { EpubChapter } from '../services/epub.js';

describe('Timeline Component & Chapter Navigation (Timeline.ts)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    invalidateChapterMarkers();
    closeChapterPopup();
  });

  it('prioritizes structured EpubChapter[] table of contents over DOM scraping (ARC-001)', () => {
    const mockContent = document.createElement('div');
    mockContent.innerHTML = `
      <section class="epub-chapter" id="ch-0">
        <h2 id="c0_intro">Introduction</h2>
        <p>Text of intro</p>
      </section>
      <section class="epub-chapter" id="ch-1">
        <h2 id="c1_chap1">Chapter I: Loomings</h2>
        <p>Call me Ishmael...</p>
      </section>
      <section class="epub-chapter" id="ch-2">
        <h2 id="c2_chap2">Chapter II: The Carpet-Bag</h2>
        <p>I stuffed a shirt or two...</p>
      </section>
    `;

    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });

    const epubChapters: EpubChapter[] = [
      { title: 'Intro Section', href: 'ch0.xhtml#intro', anchorId: 'c0_intro' },
      { title: 'Chapter 1: Loomings', href: 'ch1.xhtml#chap1', anchorId: 'c1_chap1' },
      { title: 'Chapter 2: The Carpet-Bag', href: 'ch2.xhtml#chap2', anchorId: 'c2_chap2' }
    ];

    const markers = getChapterMarkers(mockContent, mockViewport, 10, false, epubChapters);

    expect(markers.length).toBe(3);
    expect(markers[0].title).toBe('Intro Section');
    expect(markers[0].id).toBe('c0_intro');
    expect(markers[1].title).toBe('Chapter 1: Loomings');
    expect(markers[2].title).toBe('Chapter 2: The Carpet-Bag');
  });

  it('falls back to DOM heading discovery when no EpubChapter[] is provided', () => {
    const mockContent = document.createElement('div');
    mockContent.innerHTML = `
      <h2 id="heading-1">Chapter One</h2>
      <p>Content 1</p>
      <h2 id="heading-2">Chapter Two</h2>
      <p>Content 2</p>
    `;

    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });

    const markers = getChapterMarkers(mockContent, mockViewport, 10, false);

    expect(markers.length).toBe(2);
    expect(markers[0].title).toBe('Chapter One');
    expect(markers[1].title).toBe('Chapter Two');
  });

  it('correctly resolves chapter element with prefix variations (c0_id vs raw id)', () => {
    const mockContent = document.createElement('div');
    mockContent.innerHTML = `
      <div id="c0_intro">Intro Text</div>
      <div id="epilogue">Epilogue Text</div>
    `;

    // Direct match
    expect(resolveChapterElement(mockContent, 'c0_intro')?.id).toBe('c0_intro');

    // Raw fallback for prefixed query
    expect(resolveChapterElement(mockContent, 'c1_epilogue')?.id).toBe('epilogue');

    // Prefixed fallback for raw query
    expect(resolveChapterElement(mockContent, 'intro')?.id).toBe('c0_intro');
  });

  it('calculates spread index correctly within viewport bounds via getElementSpreadIndex', () => {
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });
    Object.defineProperty(mockViewport, 'scrollLeft', { value: 0, configurable: true, writable: true });
    mockViewport.getBoundingClientRect = vi.fn().mockReturnValue({ left: 0, top: 0, right: 500, bottom: 500 });

    const targetEl = document.createElement('div');
    targetEl.getBoundingClientRect = vi.fn().mockReturnValue({ left: 1200, top: 0, right: 1300, bottom: 100 });

    const spreadIdx = getElementSpreadIndex(targetEl, mockViewport, 10);
    // 1200 / 500 = 2.4 -> floor = 2
    expect(spreadIdx).toBe(2);
  });

  it('updates active chapter indicator label correctly dynamically', () => {
    const mockContent = document.createElement('div');
    mockContent.innerHTML = `
      <h2 id="ch1">Chapter 1</h2>
      <h2 id="ch2">Chapter 2</h2>
    `;

    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });

    const indicator = document.createElement('span');
    indicator.id = 'active-chapter-indicator';
    document.body.appendChild(indicator);

    try {
      updateActiveChapterLabel(mockContent, mockViewport, 0, 10);
      expect(indicator.textContent).toBe('Begin');

      updateActiveChapterLabel(mockContent, mockViewport, 9, 10);
      expect(indicator.textContent).toBe('End');
    } finally {
      indicator.remove();
    }
  });

  it('filters out page-list numbers and illustration entries from chapter markers', () => {
    const mockContent = document.createElement('div');
    mockContent.innerHTML = `
      <h2 id="c0_chap1">A Scandal in Bohemia</h2>
      <span id="c0_p1">Page 1 content</span>
      <span id="c0_p2">Page 2 content</span>
      <h2 id="c1_chap2">The Red-Headed League</h2>
      <span id="c1_p3">Page 3 content</span>
    `;

    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });

    const mixedChapters: EpubChapter[] = [
      { title: 'A Scandal in Bohemia', href: 'ch1.xhtml#chap1', anchorId: 'c0_chap1' },
      { title: 'Page 1', href: 'ch1.xhtml#p1', anchorId: 'c0_p1' },
      { title: 'Page 2', href: 'ch1.xhtml#p2', anchorId: 'c0_p2' },
      { title: 'List of Illustrations', href: 'ch1.xhtml#loi', anchorId: 'c0_loi' },
      { title: 'The Red-Headed League', href: 'ch2.xhtml#chap2', anchorId: 'c1_chap2' },
      { title: 'Page 3', href: 'ch2.xhtml#p3', anchorId: 'c1_p3' }
    ];

    const markers = getChapterMarkers(mockContent, mockViewport, 10, false, mixedChapters);
    expect(markers.length).toBe(2);
    expect(markers[0].title).toBe('A Scandal in Bohemia');
    expect(markers[1].title).toBe('The Red-Headed League');
  });

  it('uses discrete ParsedChapter[] directly without DOM queries when available', () => {
    const mockContent = document.createElement('div');
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });

    const parsedChapters = [
      { index: 0, id: 'ch-0', title: 'Hamlet: Act I', href: 'act1.xhtml', htmlContent: '<div>Act 1</div>' },
      { index: 1, id: 'ch-1', title: 'Hamlet: Act II', href: 'act2.xhtml', htmlContent: '<div>Act 2</div>' },
      { index: 2, id: 'ch-2', title: 'Hamlet: Act III', href: 'act3.xhtml', htmlContent: '<div>Act 3</div>' }
    ];

    const markers = getChapterMarkers(mockContent, mockViewport, 5, false, undefined, parsedChapters);
    expect(markers.length).toBe(3);
    expect(markers[0].title).toBe('Hamlet: Act I');
    expect(markers[0].chapterIndex).toBe(0);
    expect(markers[1].title).toBe('Hamlet: Act II');
    expect(markers[1].chapterIndex).toBe(1);
    expect(markers[2].title).toBe('Hamlet: Act III');
    expect(markers[2].chapterIndex).toBe(2);
  });

  it('centers showChapterPopup around the clicked timeline ratio in multi-chapter books', async () => {
    const { showChapterPopup, closeChapterPopup } = await import('./Timeline.js');

    // Create 100 markers with globalFraction from 0 to 0.99
    const markers = Array.from({ length: 100 }, (_, i) => ({
      id: `ch-${i}`,
      title: `Chapter ${i + 1}`,
      pageSpread: 0,
      chapterIndex: i,
      globalFraction: i / 100
    }));

    const trackRect = {
      left: 100,
      top: 500,
      width: 1000,
      right: 1100,
      bottom: 520,
      height: 20,
      x: 100,
      y: 500,
      toJSON: () => {}
    } as DOMRect;

    // Click near the end of the timeline: left + 900 = 1000 (which is 900/1000 = 90% -> chapter ~90)
    const clickX = 1000;
    const jumpSpy = vi.fn();

    showChapterPopup(markers, 0, 0, clickX, trackRect, 1, vi.fn(), jumpSpy, 0);

    const popup = document.getElementById('chapter-popup-menu');
    expect(popup).not.toBeNull();

    closeChapterPopup();
  });

  it('passes targetAnchorId to onJumpToChapter when clicking a chapter in popup or timeline dot', async () => {
    const { showChapterPopup, closeChapterPopup, renderTimeline } = await import('./Timeline.js');

    const markers = [
      {
        id: 'c1_pgepubid00024',
        title: 'Chapter 20. All Astir.',
        pageSpread: 0,
        chapterIndex: 3,
        globalFraction: 0.18,
        targetAnchorId: 'c1_pgepubid00024'
      }
    ];

    const trackRect = {
      left: 0,
      top: 500,
      width: 1000,
      right: 1000,
      bottom: 520,
      height: 20,
      x: 0,
      y: 500,
      toJSON: () => {}
    } as DOMRect;

    const jumpChapterSpy = vi.fn();
    showChapterPopup(markers, 0, 0, 180, trackRect, 1, vi.fn(), jumpChapterSpy, 3);

    const popupItem = document.querySelector<HTMLButtonElement>('.chapter-popup-item');
    expect(popupItem).not.toBeNull();
    popupItem?.click();

    expect(jumpChapterSpy).toHaveBeenCalledWith(3, 'c1_pgepubid00024');
    closeChapterPopup();

    // Verify timeline dot click as well
    const ticksContainer = document.createElement('div');
    ticksContainer.id = 'timeline-ticks';
    document.body.appendChild(ticksContainer);

    const mockContent = document.createElement('div');
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });

    const parsedChapters = [
      { index: 0, id: 'ch-0', title: 'Ch 0', href: 'ch0.xhtml', htmlContent: '<div>Cover</div>' },
      { index: 1, id: 'ch-1', title: 'Ch 1', href: 'ch1.xhtml', htmlContent: '<div id="c1_pgepubid00024">Ch 20</div>' }
    ];

    const epubChapters: EpubChapter[] = [
      { title: 'Chapter 20. All Astir.', href: 'ch1.xhtml#pgepubid00024', anchorId: 'c1_pgepubid00024', spineIndex: 1 }
    ];

    const dotJumpSpy = vi.fn();
    renderTimeline(mockContent, mockViewport, 10, vi.fn(), epubChapters, parsedChapters, dotJumpSpy, 1);

    const chapterDot = ticksContainer.querySelector<HTMLDivElement>('.timeline-dot.chapter-dot');
    expect(chapterDot).not.toBeNull();
    chapterDot?.click();

    expect(dotJumpSpy).toHaveBeenCalledWith(1, 'c1_pgepubid00024');
    ticksContainer.remove();
  });

  it('renders timeline dots on initial load of multi-chapter books even when current spine chunk has totalPagesSpreads of 1', async () => {
    const { renderTimeline } = await import('./Timeline.js');

    const ticksContainer = document.createElement('div');
    ticksContainer.id = 'timeline-ticks';
    document.body.appendChild(ticksContainer);

    const mockContent = document.createElement('div');
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });

    // Multi-chapter book with cover (spine 0) of 1 spread and chapters in spine 1
    const parsedChapters = [
      { index: 0, id: 'ch-0', title: 'Cover', href: 'wrap0000.xhtml', htmlContent: '<div>Cover SVG</div>' },
      { index: 1, id: 'ch-1', title: 'Chapter 1', href: 'ch1.xhtml', htmlContent: '<div id="c1_ch1">Text</div>' }
    ];

    const epubChapters: EpubChapter[] = [
      { title: 'Chapter 1. Loomings.', href: 'ch1.xhtml#ch1', anchorId: 'c1_ch1', spineIndex: 1 }
    ];

    // totalPagesSpreads is 1 for the cover chunk
    renderTimeline(mockContent, mockViewport, 1, vi.fn(), epubChapters, parsedChapters, vi.fn(), 0);

    const dots = ticksContainer.querySelectorAll('.timeline-dot');
    // Must render Begin, End, and Chapter dot (at least 2 dots, not empty)
    expect(dots.length).toBeGreaterThanOrEqual(2);

    ticksContainer.remove();
  });

  it('renders and interacts with chapter popup via showChapterPopup', async () => {
    const { showChapterPopup, closeChapterPopup } = await import('./Timeline.js');

    const markers = [
      { id: 'c0', title: 'Chapter 1: Loomings', pageSpread: 0, chapterIndex: 0 },
      { id: 'c1', title: 'Chapter 2: The Carpet-Bag', pageSpread: 4, chapterIndex: 1 },
      { id: 'c2', title: 'Chapter 3: The Spouter-Inn', pageSpread: 8, chapterIndex: 2 }
    ];

    const trackRect = {
      left: 100,
      top: 500,
      width: 800,
      height: 20,
      right: 900,
      bottom: 520,
      x: 100,
      y: 500,
      toJSON: () => {}
    } as DOMRect;

    const onJumpSpread = vi.fn();
    const onJumpChapter = vi.fn();

    // 1. Show popup
    showChapterPopup(markers, 4, 0, 500, trackRect, 10, onJumpSpread, onJumpChapter, 0);

    const popup = document.querySelector('.chapter-popup-menu') as HTMLElement;
    expect(popup).not.toBeNull();

    // Verify items rendered
    const items = popup.querySelectorAll('.chapter-popup-item');
    expect(items.length).toBe(3);

    // 2. Click a chapter item
    const secondItem = items[1] as HTMLElement;
    secondItem.click();
    expect(onJumpChapter).toHaveBeenCalledWith(1, 0);

    // After click, popup is closed
    expect(document.querySelector('.chapter-popup-menu')).toBeNull();

    // 3. Re-open and close with Escape key
    vi.useFakeTimers();
    showChapterPopup(markers, 4, 0, 500, trackRect, 10, onJumpSpread, onJumpChapter, 0);
    expect(document.querySelector('.chapter-popup-menu')).not.toBeNull();

    // Advance past the 20ms listener attachment timeout
    vi.advanceTimersByTime(50);
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    window.dispatchEvent(escEvent);
    expect(document.querySelector('.chapter-popup-menu')).toBeNull();
    vi.useRealTimers();

    // 4. closeChapterPopup directly
    showChapterPopup(markers, 4, 0, 500, trackRect, 10, onJumpSpread, onJumpChapter, 0);
    closeChapterPopup();
    expect(document.querySelector('.chapter-popup-menu')).toBeNull();
  });

  it('triggers showChapterPopup on progress-track long press and jump on short press', async () => {
    const { renderTimeline } = await import('./Timeline.js');

    const track = document.createElement('div');
    track.id = 'progress-track';
    document.body.appendChild(track);

    const ticks = document.createElement('div');
    ticks.id = 'timeline-ticks';
    document.body.appendChild(ticks);

    const mockContent = document.createElement('div');
    mockContent.innerHTML = '<h2 id="ch1">Chapter 1</h2><h2 id="ch2">Chapter 2</h2>';
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });

    track.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 1000,
        height: 20,
        right: 1000,
        bottom: 20
      }) as DOMRect;

    const jumpSpreadSpy = vi.fn();
    renderTimeline(mockContent, mockViewport, 10, jumpSpreadSpy);

    // Short press -> onJumpToSpread
    const mouseDown = new MouseEvent('mousedown', { clientX: 500, clientY: 10, button: 0 });
    track.onmousedown?.(mouseDown);
    const mouseUp = new MouseEvent('mouseup', { clientX: 500, clientY: 10, button: 0 });
    track.onmouseup?.(mouseUp);
    expect(jumpSpreadSpy).toHaveBeenCalled();

    // Contextmenu event triggers showChapterPopup
    const contextMenuEvent = new MouseEvent('contextmenu', { clientX: 500, clientY: 10 });
    track.oncontextmenu?.(contextMenuEvent as unknown as PointerEvent);
    expect(document.querySelector('.chapter-popup-menu')).not.toBeNull();
    closeChapterPopup();

    // Long press -> opens chapter popup
    vi.useFakeTimers();
    track.onmousedown?.(new MouseEvent('mousedown', { clientX: 500, clientY: 10, button: 0 }));
    vi.advanceTimersByTime(400);

    const popup = document.querySelector('.chapter-popup-menu');
    expect(popup).not.toBeNull();
    closeChapterPopup();
    track.onmouseup?.(new MouseEvent('mouseup', { clientX: 500, clientY: 10, button: 0 }));
    vi.advanceTimersByTime(450);

    // Mouseleave cancels press
    track.onmousedown?.(new MouseEvent('mousedown', { clientX: 500, clientY: 10, button: 0 }));
    track.onmouseleave?.(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(400);
    expect(document.querySelector('.chapter-popup-menu')).toBeNull();

    // Verify accessible begin and end dots
    const beginDot = ticks.querySelector('.begin-dot') as HTMLElement;
    const endDot = ticks.querySelector('.end-dot') as HTMLElement;
    expect(beginDot).not.toBeNull();
    expect(endDot).not.toBeNull();

    // Enter key on beginDot
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    beginDot.dispatchEvent(enterEvent);
    expect(jumpSpreadSpy).toHaveBeenCalledWith(0);

    // Space key on endDot
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', cancelable: true });
    endDot.dispatchEvent(spaceEvent);
    expect(jumpSpreadSpy).toHaveBeenCalledWith(9);

    vi.useRealTimers();
    track.remove();
    ticks.remove();
    const existingPopup = document.querySelector('.chapter-popup-menu');
    if (existingPopup) existingPopup.remove();
  });

  it('navigates multi-chapter beginDot and endDot to chapter indices', async () => {
    invalidateChapterMarkers();
    const { renderTimeline } = await import('./Timeline.js');

    const ticks = document.createElement('div');
    ticks.id = 'timeline-ticks';
    document.body.appendChild(ticks);

    const mockContent = document.createElement('div');
    const mockViewport = document.createElement('div') as HTMLDivElement;
    Object.defineProperty(mockViewport, 'clientWidth', { value: 500, configurable: true });

    const parsedChapters = [
      { index: 0, id: 'ch-0', title: 'Chapter 1', href: 'ch1.xhtml', htmlContent: '<div>Text</div>' },
      { index: 1, id: 'ch-1', title: 'Chapter 2', href: 'ch2.xhtml', htmlContent: '<div>Text</div>' }
    ];

    const jumpChapterSpy = vi.fn();
    renderTimeline(mockContent, mockViewport, 5, vi.fn(), undefined, parsedChapters, jumpChapterSpy, 0);

    const beginDot = ticks.querySelector('.begin-dot') as HTMLElement;
    const endDot = ticks.querySelector('.end-dot') as HTMLElement;

    beginDot.click();
    expect(jumpChapterSpy).toHaveBeenCalledWith(0, 0);

    endDot.click();
    expect(jumpChapterSpy).toHaveBeenCalledWith(1, 'last');

    ticks.remove();
  });
});
