// --- Shared Test Fixtures & Mock Builders for Zenolet ---
import type { SpineChapter, TocChapter } from '../types.js';

export interface MockDOMOptions {
  clientWidth?: number;
  scrollWidth?: number;
  scrollLeft?: number;
}

/**
 * Creates a mock reader viewport HTMLDivElement with configurable layout dimensions and scroll behavior.
 */
export function createMockViewport(options: MockDOMOptions = {}): HTMLDivElement {
  const { clientWidth = 500, scrollWidth = 5000, scrollLeft = 0 } = options;
  const viewport = document.createElement('div') as HTMLDivElement;

  Object.defineProperty(viewport, 'clientWidth', { value: clientWidth, configurable: true, writable: true });
  Object.defineProperty(viewport, 'scrollWidth', { value: scrollWidth, configurable: true, writable: true });
  viewport.scrollLeft = scrollLeft;

  return viewport;
}

/**
 * Creates a mock reader content HTMLElement with configurable scrollWidth.
 */
export function createMockContent(options: MockDOMOptions = {}): HTMLElement {
  const { scrollWidth = 5000 } = options;
  const content = document.createElement('div') as HTMLElement;

  Object.defineProperty(content, 'scrollWidth', { value: scrollWidth, configurable: true, writable: true });

  return content;
}

/**
 * Helper to build an array of mock Spine Chapters (ParsedChapter objects).
 */
export function createMockSpineChapters(
  count: number,
  options: { baseContent?: string; charMultiplier?: number } = {}
): SpineChapter[] {
  const { baseContent = 'Sample chapter paragraph content. ', charMultiplier = 100 } = options;
  const chapters: SpineChapter[] = [];

  for (let i = 0; i < count; i++) {
    chapters.push({
      index: i,
      id: `c${i}`,
      title: `Chapter ${i + 1}`,
      href: `chapter_${i + 1}.xhtml`,
      htmlContent: `<section id="sec-${i}"><h2>Chapter ${i + 1}</h2><p>${baseContent.repeat(charMultiplier)}</p></section>`
    });
  }

  return chapters;
}

/**
 * Helper to build an array of mock Table of Contents Chapters (EpubChapter objects).
 */
export function createMockTocChapters(
  count: number,
  options: { spineIndex?: number; anchorPrefix?: string } = {}
): TocChapter[] {
  const { anchorPrefix = 'c' } = options;
  const toc: TocChapter[] = [];

  for (let i = 0; i < count; i++) {
    const spineIdx = typeof options.spineIndex === 'number' ? options.spineIndex : i;
    toc.push({
      title: `Chapter ${i + 1}`,
      href: `chapter_${spineIdx + 1}.xhtml#${anchorPrefix}${i}_anchor`,
      anchorId: `${anchorPrefix}${i}_anchor`,
      spineIndex: spineIdx
    });
  }

  return toc;
}
