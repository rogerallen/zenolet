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

export function recalculatePages(
  readerViewport: HTMLDivElement,
  readerContent: HTMLElement,
  snapPoints: HTMLDivElement,
  progressFill: HTMLDivElement,
  pageIndicator: HTMLSpanElement,
  state: ReaderState,
  activeBookId: string | null,
  preserveDOMScroll: boolean = true,
  skipSaveProgress: boolean = false,
  epubChapters?: EpubChapter[]
): void {
  if (!activeBookId) return;

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
  readerViewport: HTMLDivElement,
  readerContent: HTMLElement,
  progressFill: HTMLDivElement,
  pageIndicator: HTMLSpanElement,
  state: ReaderState,
  activeBookId: string | null,
  actualCols?: number,
  skipSaveProgress: boolean = false
): void {
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
