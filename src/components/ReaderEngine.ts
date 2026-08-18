// --- Reader Engine Component for Zenolet ---
import { restoreBookProgressByFraction, saveBookProgress, getStoredProgressFraction } from '../services/storage.js';
import { updateActiveChapterLabel, renderTimeline } from './Timeline.js';

import type { EpubChapter } from '../services/epub.js';

export interface ReaderState {
  currentView: 'library' | 'reader';
  theme: 'paper' | 'sepia' | 'charcoal' | 'night';
  fontSize: number;
  layoutColumns: 'auto' | '1' | '2';
  currentPageSpread: number;
  totalPagesSpreads: number;
}

export function setTheme(theme: 'paper' | 'sepia' | 'charcoal' | 'night', state: ReaderState): void {
  state.theme = theme;
  document.body.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('zenolet-theme', theme);
  } catch (e) {
    console.warn('[Zenolet Reader] Failed to save theme to localStorage:', e);
  }

  document.querySelectorAll('.theme-btn').forEach((btn) => {
    if (btn.getAttribute('data-theme') === theme) {
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

export function setLayoutColumns(cols: 'auto' | '1' | '2', state: ReaderState, recalculateFn: () => void): void {
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

  const isWide = window.innerWidth > 768;
  const layoutCols = state.layoutColumns;
  const actualCols = layoutCols === '2' || (layoutCols === 'auto' && isWide) ? 2 : 1;

  readerContent.classList.remove('one-column', 'two-columns');

  if (actualCols === 2) {
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

  const cols = actualCols ?? (readerContent.classList.contains('two-columns') ? 2 : 1);
  const scrollLeft = readerViewport.scrollLeft;
  const currentSpread = Math.min(state.totalPagesSpreads - 1, Math.max(0, Math.round(scrollLeft / pageWidth)));

  state.currentPageSpread = currentSpread;

  const progressPercent = state.totalPagesSpreads > 1 ? (currentSpread / (state.totalPagesSpreads - 1)) * 100 : 100;
  progressFill.style.width = `${progressPercent}%`;

  if (cols === 1) {
    pageIndicator.textContent = `Page ${currentSpread + 1} of ${state.totalPagesSpreads}`;
  } else {
    const startPage = currentSpread * 2 + 1;
    const endPage = Math.min(state.totalPagesSpreads * 2, currentSpread * 2 + 2);

    if (startPage === endPage) {
      pageIndicator.textContent = `Page ${startPage} of ${state.totalPagesSpreads * 2}`;
    } else {
      pageIndicator.textContent = `Pages ${startPage}–${endPage} of ${state.totalPagesSpreads * 2}`;
    }
  }

  if (activeBookId && !skipSaveProgress) {
    const maxScroll = readerViewport.scrollWidth - pageWidth;
    const progressFraction = maxScroll > 0 ? scrollLeft / maxScroll : 0;
    saveBookProgress(activeBookId, progressFraction);
  }

  updateActiveChapterLabel(readerContent, readerViewport, state.currentPageSpread, state.totalPagesSpreads);
}

export function setupDragToScroll(viewport: HTMLDivElement): void {
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;

  viewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('a, button, input, [role="button"]')) return;
    isDown = true;
    startX = e.pageX - viewport.offsetLeft;
    scrollLeft = viewport.scrollLeft;
  });

  viewport.addEventListener('mouseleave', () => {
    isDown = false;
    viewport.classList.remove('active');
  });

  viewport.addEventListener('mouseup', () => {
    isDown = false;
    viewport.classList.remove('active');
  });

  viewport.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const x = e.pageX - viewport.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 8) {
      viewport.classList.add('active');
      e.preventDefault();
      viewport.scrollLeft = scrollLeft - walk;
    }
  });
}
