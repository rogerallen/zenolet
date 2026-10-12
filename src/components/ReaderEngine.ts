// --- Reader Engine Component for Zenolet ---
import { restoreBookProgressByFraction, saveBookProgress, getStoredProgressFraction } from '../services/storage.js';
import { updateActiveChapterLabel, renderTimeline } from './Timeline.js';
import { calculateBookPagination } from '../services/virtualization.js';

import type { EpubChapter, ParsedChapter } from '../services/epub.js';

const measuredChapterSpreadsCache = new Map<number, number>();
let activeParsedChaptersForReader: ParsedChapter[] | null = null;

export function setReaderParsedChapters(chapters?: ParsedChapter[]): void {
  activeParsedChaptersForReader = chapters && chapters.length > 0 ? chapters : null;
}

export function clearMeasuredSpreadsCache(): void {
  measuredChapterSpreadsCache.clear();
}

export function premeasureAllChapterSpreads(
  readerViewport: HTMLDivElement,
  readerContent: HTMLElement,
  chapters: ParsedChapter[]
): void {
  if (typeof window === 'undefined' || !readerViewport || !readerContent || !chapters) return;
  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0) return;

  // Check if all chapters are already measured
  if (chapters.every((_, idx) => measuredChapterSpreadsCache.has(idx))) return;

  const clone = readerContent.cloneNode(false) as HTMLElement;
  clone.style.visibility = 'hidden';
  clone.style.position = 'absolute';
  clone.style.top = '-99999px';
  clone.style.left = '-99999px';
  clone.style.height = `${readerViewport.clientHeight}px`;
  clone.style.pointerEvents = 'none';

  readerViewport.appendChild(clone);

  try {
    const maxChaptersToPremeasure = Math.min(chapters.length, 50);
    for (let i = 0; i < maxChaptersToPremeasure; i++) {
      if (!measuredChapterSpreadsCache.has(i)) {
        clone.innerHTML = chapters[i].htmlContent;
        const scrollWidth = clone.scrollWidth;
        if (scrollWidth > 0) {
          const spreads = Math.max(1, Math.ceil(scrollWidth / pageWidth));
          measuredChapterSpreadsCache.set(i, spreads);
        }
      }
    }
  } finally {
    clone.remove();
  }
}

export function measureOffscreenChapterSpreads(
  readerViewport: HTMLDivElement,
  readerContent: HTMLElement,
  htmlContent: string
): number {
  if (typeof window === 'undefined' || !readerViewport || !readerContent) return 1;
  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0) return 1;

  const clone = readerContent.cloneNode(false) as HTMLElement;
  clone.style.visibility = 'hidden';
  clone.style.position = 'absolute';
  clone.style.top = '-99999px';
  clone.style.left = '-99999px';
  clone.style.height = `${readerViewport.clientHeight}px`;
  clone.style.pointerEvents = 'none';
  clone.innerHTML = htmlContent;

  readerViewport.appendChild(clone);
  const scrollWidth = clone.scrollWidth;
  clone.remove();

  return Math.max(1, Math.ceil(scrollWidth / pageWidth));
}

export interface ReaderState {
  currentView: 'library' | 'reader';
  theme: 'paper' | 'sepia' | 'slate' | 'charcoal' | 'night';
  fontSize: number;
  layoutColumns: 'auto' | '1' | '2' | '3';
  currentPageSpread: number;
  totalPagesSpreads: number;
  currentChapterIndex?: number;
  totalChapters?: number;
  globalProgress?: number;
  bookTotalPages?: number;
  bookCurrentPage?: number;
  bookEndPage?: number;
}

export function setTheme(theme: 'paper' | 'sepia' | 'slate' | 'charcoal' | 'night', state: ReaderState): void {
  const normalizedTheme = (theme === 'charcoal' ? 'slate' : theme) as 'paper' | 'sepia' | 'slate' | 'night';
  state.theme = normalizedTheme;
  document.body.setAttribute('data-theme', normalizedTheme);
  try {
    localStorage.setItem('zenolet-theme', normalizedTheme);
  } catch (e) {
    console.warn('[Zenolet Reader] Failed to save theme to localStorage:', e);
  }

  document.querySelectorAll('.theme-btn').forEach((btn) => {
    const btnTheme = btn.getAttribute('data-theme');
    if (btnTheme === normalizedTheme || (btnTheme === 'slate' && theme === 'charcoal')) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

export function setFontSize(size: number, state: ReaderState, recalculateFn: () => void): void {
  clearMeasuredSpreadsCache();
  state.fontSize = size;
  const content = document.getElementById('reader-content');
  const sizeDisplay = document.getElementById('font-size-display');

  if (content) content.style.fontSize = `${size}px`;
  if (sizeDisplay) sizeDisplay.textContent = `${size}px`;
  try {
    localStorage.setItem('zenolet-font-size', size.toString());
  } catch (e) {
    console.warn('[Zenolet Reader] Failed to save font size to localStorage:', e);
  }
  recalculateFn();
}

export function setLayoutColumns(cols: 'auto' | '1' | '2' | '3', state: ReaderState, recalculateFn: () => void): void {
  clearMeasuredSpreadsCache();
  state.layoutColumns = cols;
  try {
    localStorage.setItem('zenolet-layout-columns', cols);
  } catch (e) {
    console.warn('[Zenolet Reader] Failed to save layout columns to localStorage:', e);
  }

  document.querySelectorAll('.layout-btn').forEach((btn) => {
    if (btn.getAttribute('data-columns') === cols) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  recalculateFn();
}

export interface ReaderElements {
  readerViewport: HTMLDivElement;
  readerContent: HTMLElement;
  snapPoints: HTMLDivElement;
  progressFill: HTMLDivElement;
  pageIndicator: HTMLSpanElement;
}

export interface RecalculateOptions {
  preserveDOMScroll?: boolean;
  skipSaveProgress?: boolean;
  epubChapters?: EpubChapter[];
  parsedChapters?: ParsedChapter[];
  onJumpToChapter?: (chapterIndex: number, targetSpread?: number | 'last' | string) => void;
}

export function recalculatePages(
  elements: ReaderElements,
  state: ReaderState,
  activeBookId: string | null,
  options?: RecalculateOptions
): void;
export function recalculatePages(
  readerViewport: HTMLDivElement,
  readerContent: HTMLElement,
  snapPoints: HTMLDivElement,
  progressFill: HTMLDivElement,
  pageIndicator: HTMLSpanElement,
  state: ReaderState,
  activeBookId: string | null,
  preserveDOMScroll?: boolean,
  skipSaveProgress?: boolean,
  epubChapters?: EpubChapter[],
  parsedChapters?: ParsedChapter[],
  onJumpToChapter?: (chapterIndex: number, targetSpread?: number | 'last' | string) => void
): void;
export function recalculatePages(
  arg1: ReaderElements | HTMLDivElement,
  arg2: ReaderState | HTMLElement,
  arg3?: string | null | HTMLDivElement,
  arg4?: RecalculateOptions | HTMLDivElement,
  arg5?: HTMLSpanElement,
  arg6?: ReaderState,
  arg7?: string | null,
  arg8?: boolean,
  arg9?: boolean,
  arg10?: EpubChapter[],
  arg11?: ParsedChapter[],
  arg12?: (chapterIndex: number, targetSpread?: number | 'last' | string) => void
): void {
  let elements: ReaderElements;
  let state: ReaderState;
  let activeBookId: string | null;
  let preserveDOMScroll: boolean;
  let skipSaveProgress: boolean;
  let epubChapters: EpubChapter[] | undefined;
  let parsedChapters: ParsedChapter[] | undefined;
  let onJumpToChapter: ((chapterIndex: number, targetSpread?: number | 'last' | string) => void) | undefined;

  if (arg1 && 'readerViewport' in arg1) {
    elements = arg1;
    state = arg2 as ReaderState;
    activeBookId = (arg3 as string | null) ?? null;
    const opts = arg4 as RecalculateOptions | undefined;
    preserveDOMScroll = opts?.preserveDOMScroll ?? true;
    skipSaveProgress = opts?.skipSaveProgress ?? false;
    epubChapters = opts?.epubChapters;
    parsedChapters = opts?.parsedChapters;
    onJumpToChapter = opts?.onJumpToChapter;
  } else {
    elements = {
      readerViewport: arg1 as HTMLDivElement,
      readerContent: arg2 as HTMLElement,
      snapPoints: arg3 as HTMLDivElement,
      progressFill: arg4 as HTMLDivElement,
      pageIndicator: arg5 as HTMLSpanElement
    };
    state = arg6 as ReaderState;
    activeBookId = (arg7 as string | null) ?? null;
    preserveDOMScroll = arg8 ?? true;
    skipSaveProgress = arg9 ?? false;
    epubChapters = arg10;
    parsedChapters = arg11;
    onJumpToChapter = arg12;
  }

  if (!activeBookId) return;

  const { readerViewport, readerContent, snapPoints, progressFill, pageIndicator } = elements;
  const prevProgress = preserveDOMScroll ? getStoredProgressFraction(readerViewport) : 0;
  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0) return;

  readerContent.style.width = 'auto';
  readerContent.style.columnWidth = `${pageWidth}px`;

  const isLarge = window.innerWidth >= 1500;
  const isWide = window.innerWidth > 768;
  const layoutCols = state.layoutColumns;
  const actualCols =
    layoutCols === '3' || (layoutCols === 'auto' && isLarge)
      ? 3
      : layoutCols === '2' || (layoutCols === 'auto' && isWide)
        ? 2
        : 1;

  readerContent.classList.remove('one-column', 'two-columns', 'three-columns');

  if (actualCols === 3) {
    readerContent.classList.add('three-columns');
    readerContent.style.columnWidth = `${pageWidth / 3}px`;
  } else if (actualCols === 2) {
    readerContent.classList.add('two-columns');
    readerContent.style.columnWidth = `${pageWidth / 2}px`;
  } else {
    readerContent.classList.add('one-column');
    readerContent.style.columnWidth = `${pageWidth}px`;
  }

  alignChapterPageBreaks(readerContent);

  const totalScrollWidth = readerContent.scrollWidth;
  const numSpreads = Math.max(1, Math.ceil(totalScrollWidth / pageWidth));

  state.totalPagesSpreads = numSpreads;
  readerContent.style.width = `${numSpreads * pageWidth}px`;

  snapPoints.innerHTML = '';
  snapPoints.style.width = `${numSpreads * pageWidth}px`;

  for (let i = 0; i < numSpreads; i++) {
    const snapTarget = document.createElement('div');
    snapTarget.className = 'snap-target';
    snapTarget.style.width = `${pageWidth}px`;
    snapPoints.appendChild(snapTarget);
  }

  if (preserveDOMScroll && prevProgress > 0) {
    restoreBookProgressByFraction(prevProgress, readerViewport);
  } else if (!preserveDOMScroll) {
    readerViewport.scrollLeft = 0;
  }

  if (parsedChapters) {
    setReaderParsedChapters(parsedChapters);
  }

  // Pre-measure all chapters to ensure total pages count is 100% stable across the whole book
  if (activeParsedChaptersForReader && activeParsedChaptersForReader.length > 1 && pageWidth > 0) {
    measuredChapterSpreadsCache.set(state.currentChapterIndex ?? 0, numSpreads);
    premeasureAllChapterSpreads(readerViewport, readerContent, activeParsedChaptersForReader);
  }

  updatePaginationIndicator(
    readerViewport,
    readerContent,
    progressFill,
    pageIndicator,
    state,
    activeBookId,
    actualCols,
    skipSaveProgress,
    parsedChapters
  );

  renderTimeline(
    readerContent,
    readerViewport,
    state.totalPagesSpreads,
    (spreadIndex) => {
      readerViewport.scrollTo({
        left: spreadIndex * pageWidth,
        behavior: 'auto'
      });
    },
    epubChapters,
    parsedChapters,
    onJumpToChapter,
    state.currentChapterIndex,
    state.globalProgress
  );
}

export function updatePaginationIndicator(
  elements: Pick<ReaderElements, 'readerViewport' | 'readerContent' | 'progressFill' | 'pageIndicator'>,
  state: ReaderState,
  activeBookId: string | null,
  actualCols?: number,
  skipSaveProgress?: boolean,
  parsedChapters?: ParsedChapter[]
): void;
export function updatePaginationIndicator(
  readerViewport: HTMLDivElement,
  readerContent: HTMLElement,
  progressFill: HTMLDivElement,
  pageIndicator: HTMLSpanElement,
  state: ReaderState,
  activeBookId: string | null,
  actualCols?: number,
  skipSaveProgress?: boolean,
  parsedChapters?: ParsedChapter[]
): void;
export function updatePaginationIndicator(
  arg1: Pick<ReaderElements, 'readerViewport' | 'readerContent' | 'progressFill' | 'pageIndicator'> | HTMLDivElement,
  arg2: ReaderState | HTMLElement,
  arg3?: string | null | HTMLDivElement,
  arg4?: number | HTMLSpanElement,
  arg5?: boolean | ReaderState,
  arg6?: string | null | ParsedChapter[],
  arg7?: number,
  arg8: boolean = false,
  arg9?: ParsedChapter[]
): void {
  let readerViewport: HTMLDivElement;
  let readerContent: HTMLElement;
  let progressFill: HTMLDivElement;
  let pageIndicator: HTMLSpanElement;
  let state: ReaderState;
  let activeBookId: string | null;
  let actualCols: number | undefined;
  let skipSaveProgress: boolean;
  let parsedChapters: ParsedChapter[] | undefined;

  if (arg1 && 'readerViewport' in arg1) {
    readerViewport = arg1.readerViewport;
    readerContent = arg1.readerContent;
    progressFill = arg1.progressFill;
    pageIndicator = arg1.pageIndicator;
    state = arg2 as ReaderState;
    activeBookId = (arg3 as string | null) ?? null;
    actualCols = arg4 as number | undefined;
    skipSaveProgress = (arg5 as boolean) ?? false;
    parsedChapters = arg6 as ParsedChapter[] | undefined;
  } else {
    readerViewport = arg1 as HTMLDivElement;
    readerContent = arg2 as HTMLElement;
    progressFill = arg3 as HTMLDivElement;
    pageIndicator = arg4 as HTMLSpanElement;
    state = arg5 as ReaderState;
    activeBookId = (arg6 as string | null) ?? null;
    actualCols = arg7;
    skipSaveProgress = arg8 ?? false;
    parsedChapters = arg9;
  }
  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0) return;

  const cols =
    actualCols ??
    (readerContent.classList.contains('three-columns') ? 3 : readerContent.classList.contains('two-columns') ? 2 : 1);
  const scrollLeft = readerViewport.scrollLeft;
  const currentSpread = Math.min(state.totalPagesSpreads - 1, Math.max(0, Math.round(scrollLeft / pageWidth)));

  state.currentPageSpread = currentSpread;

  const chapterPrefix =
    state.totalChapters && state.totalChapters > 1
      ? `Ch. ${(state.currentChapterIndex ?? 0) + 1} of ${state.totalChapters} · `
      : '';

  const progressPercent =
    typeof state.globalProgress === 'number'
      ? state.globalProgress * 100
      : state.totalPagesSpreads > 1
        ? (currentSpread / (state.totalPagesSpreads - 1)) * 100
        : 100;
  progressFill.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;

  const parsedChaptersToUse = parsedChapters || activeParsedChaptersForReader || undefined;

  const pagination = calculateBookPagination(
    state.currentChapterIndex ?? 0,
    currentSpread,
    state.totalPagesSpreads,
    parsedChaptersToUse || [],
    cols,
    measuredChapterSpreadsCache
  );

  state.bookTotalPages = pagination.totalPages;
  state.bookCurrentPage = pagination.startPage;
  state.bookEndPage = pagination.endPage;

  if (cols === 1 || pagination.startPage === pagination.endPage) {
    pageIndicator.textContent = `${chapterPrefix}Page ${pagination.startPage} of ${pagination.totalPages}`;
  } else {
    pageIndicator.textContent = `${chapterPrefix}Pages ${pagination.startPage}–${pagination.endPage} of ${pagination.totalPages}`;
  }

  if (activeBookId && !skipSaveProgress) {
    const maxScroll = readerViewport.scrollWidth - pageWidth;
    const chapterSpreadFraction = maxScroll > 0 ? scrollLeft / maxScroll : 0;
    const progressFraction = typeof state.globalProgress === 'number' ? state.globalProgress : chapterSpreadFraction;
    saveBookProgress(activeBookId, progressFraction, state.currentChapterIndex, chapterSpreadFraction);
  }

  updateActiveChapterLabel(readerContent, readerViewport, state.currentPageSpread, state.totalPagesSpreads);
}

/**
 * Dynamically fills remaining column height at chapter boundaries and horizontal rules
 * so the next chapter/section begins cleanly at the top of the next column across all browsers.
 */
export function alignChapterPageBreaks(readerContent: HTMLElement): void {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return;

  const contentStyle = window.getComputedStyle(readerContent);
  const paddingTop = parseFloat(contentStyle.paddingTop) || 0;
  const paddingBottom = parseFloat(contentStyle.paddingBottom) || 0;
  const columnHeight = readerContent.clientHeight - paddingTop - paddingBottom;
  if (columnHeight <= 0) return;

  const contentRect = readerContent.getBoundingClientRect();
  const contentTop = contentRect.top + paddingTop;

  const separators = readerContent.querySelectorAll<HTMLElement>(
    '.epub-chapter-separator, hr:not(.tb):not(.short):not(.half):not([class*="r"]):not(.thought-break):not(.footnotes):not(.fn):not(.notes)'
  );

  // 1. Reset all separator heights to 0 to measure natural layout
  for (const sep of separators) {
    sep.style.height = '0px';
  }

  // 2. Measure and set each visible separator to fill the remaining column height
  for (const sep of separators) {
    if (window.getComputedStyle(sep).display === 'none') continue;
    const rect = sep.getBoundingClientRect();
    const topInsideColumn = (rect.top - contentTop) % columnHeight;
    const normalizedTop = topInsideColumn < 0 ? topInsideColumn + columnHeight : topInsideColumn;
    const remainingHeight = columnHeight - normalizedTop;

    // If remainingHeight > 2 and less than columnHeight - 2, fill the remaining column space
    if (remainingHeight > 2 && remainingHeight < columnHeight - 2) {
      sep.style.height = `${remainingHeight}px`;
    } else {
      sep.style.height = '0px';
    }
  }
}
