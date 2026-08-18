import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getChapterMarkers,
  updateActiveChapterLabel,
  resolveChapterElement,
  getElementSpreadIndex,
  invalidateChapterMarkers
} from './Timeline.js';
import type { EpubChapter } from '../services/epub.js';

describe('Timeline Component & Chapter Navigation (Timeline.ts)', () => {
  beforeEach(() => {
    invalidateChapterMarkers();
    const existing = document.getElementById('active-chapter-indicator');
    if (existing) existing.remove();
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
});
