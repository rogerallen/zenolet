// --- Reader Engine Component for Zenolet ---
import { restoreBookProgressByFraction, saveBookProgress, getStoredProgressFraction } from '../services/storage.js';
import { updateActiveChapterLabel, renderTimeline } from './Timeline.js';

import type { EpubChapter } from '../services/epub.js';

export interface ReaderState {
  currentView: 'library' | 'reader';
  theme: 'paper' | 'sepia' | 'slate' | 'charcoal' | 'night';
  fontSize: number;
  layoutColumns: 'auto' | '1' | '2' | '3';
  currentPageSpread: number;
  totalPagesSpreads: number;
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
  epubChapters?: EpubChapter[]
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
  arg10?: EpubChapter[]
): void {
  let elements: ReaderElements;
  let state: ReaderState;
  let activeBookId: string | null;
  let preserveDOMScroll: boolean;
  let skipSaveProgress: boolean;
  let epubChapters: EpubChapter[] | undefined;

  if (arg1 && 'readerViewport' in arg1) {
    elements = arg1;
    state = arg2 as ReaderState;
    activeBookId = (arg3 as string | null) ?? null;
    const opts = arg4 as RecalculateOptions | undefined;
    preserveDOMScroll = opts?.preserveDOMScroll ?? true;
    skipSaveProgress = opts?.skipSaveProgress ?? false;
    epubChapters = opts?.epubChapters;
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

  updatePaginationIndicator(
    readerViewport,
    readerContent,
    progressFill,
    pageIndicator,
    state,
    activeBookId,
    actualCols,
    skipSaveProgress
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
    epubChapters
  );
}

export function updatePaginationIndicator(
  elements: Pick<ReaderElements, 'readerViewport' | 'readerContent' | 'progressFill' | 'pageIndicator'>,
  state: ReaderState,
  activeBookId: string | null,
  actualCols?: number,
  skipSaveProgress?: boolean
): void;
export function updatePaginationIndicator(
  readerViewport: HTMLDivElement,
  readerContent: HTMLElement,
  progressFill: HTMLDivElement,
  pageIndicator: HTMLSpanElement,
  state: ReaderState,
  activeBookId: string | null,
  actualCols?: number,
  skipSaveProgress?: boolean
): void;
export function updatePaginationIndicator(
  arg1: Pick<ReaderElements, 'readerViewport' | 'readerContent' | 'progressFill' | 'pageIndicator'> | HTMLDivElement,
  arg2: ReaderState | HTMLElement,
  arg3?: string | null | HTMLDivElement,
  arg4?: number | HTMLSpanElement,
  arg5?: boolean | ReaderState,
  arg6?: string | null,
  arg7?: number,
  arg8: boolean = false
): void {
  let readerViewport: HTMLDivElement;
  let readerContent: HTMLElement;
  let progressFill: HTMLDivElement;
  let pageIndicator: HTMLSpanElement;
  let state: ReaderState;
  let activeBookId: string | null;
  let actualCols: number | undefined;
  let skipSaveProgress: boolean;

  if (arg1 && 'readerViewport' in arg1) {
    readerViewport = arg1.readerViewport;
    readerContent = arg1.readerContent;
    progressFill = arg1.progressFill;
    pageIndicator = arg1.pageIndicator;
    state = arg2 as ReaderState;
    activeBookId = (arg3 as string | null) ?? null;
    actualCols = arg4 as number | undefined;
    skipSaveProgress = (arg5 as boolean) ?? false;
  } else {
    readerViewport = arg1 as HTMLDivElement;
    readerContent = arg2 as HTMLElement;
    progressFill = arg3 as HTMLDivElement;
    pageIndicator = arg4 as HTMLSpanElement;
    state = arg5 as ReaderState;
    activeBookId = (arg6 as string | null) ?? null;
    actualCols = arg7;
    skipSaveProgress = arg8 ?? false;
  }
  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0) return;

  const cols =
    actualCols ??
    (readerContent.classList.contains('three-columns') ? 3 : readerContent.classList.contains('two-columns') ? 2 : 1);
  const scrollLeft = readerViewport.scrollLeft;
  const currentSpread = Math.min(state.totalPagesSpreads - 1, Math.max(0, Math.round(scrollLeft / pageWidth)));

  state.currentPageSpread = currentSpread;

  const progressPercent = state.totalPagesSpreads > 1 ? (currentSpread / (state.totalPagesSpreads - 1)) * 100 : 100;
  progressFill.style.width = `${progressPercent}%`;

  if (cols === 1) {
    pageIndicator.textContent = `Page ${currentSpread + 1} of ${state.totalPagesSpreads}`;
  } else {
    const totalPages = state.totalPagesSpreads * cols;
    const startPage = currentSpread * cols + 1;
    const endPage = Math.min(totalPages, currentSpread * cols + cols);

    if (startPage === endPage) {
      pageIndicator.textContent = `Page ${startPage} of ${totalPages}`;
    } else {
      pageIndicator.textContent = `Pages ${startPage}–${endPage} of ${totalPages}`;
    }
  }

  if (activeBookId && !skipSaveProgress) {
    const maxScroll = readerViewport.scrollWidth - pageWidth;
    const progressFraction = maxScroll > 0 ? scrollLeft / maxScroll : 0;
    saveBookProgress(activeBookId, progressFraction);
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
