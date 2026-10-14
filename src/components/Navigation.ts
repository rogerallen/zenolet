// --- Navigation, Keyboard & Modal Interaction Controller for Zenolet ---
import { getElementSpreadIndex, resolveChapterElement } from './Timeline.js';
import type { ReaderState } from './ReaderEngine.js';

export interface ModalElements {
  aboutModal?: HTMLElement | null;
  qrModal?: HTMLElement | null;
  discoverPanel?: HTMLElement | null;
  discoverOverlay?: HTMLElement | null;
  settingsPanel?: HTMLElement | null;
  onCloseQR?: () => void;
  onCloseDiscover?: () => void;
}

export interface NavigationOptions {
  modals: ModalElements;
  readerViewport: HTMLDivElement;
  readerState: ReaderState;
  readerContent?: HTMLElement;
  onNextChapter?: () => void;
  onPrevChapter?: () => void;
}

export function navigateForward(
  readerViewport: HTMLDivElement,
  readerState: ReaderState,
  onNextChapter?: () => void
): void {
  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0) return;
  const currentSpread = readerState.currentPageSpread;
  const totalSpreads = readerState.totalPagesSpreads;

  if (currentSpread < totalSpreads - 1) {
    const targetSpread = currentSpread + 1;
    if (typeof readerViewport.scrollTo === 'function') {
      readerViewport.scrollTo({ left: targetSpread * pageWidth, behavior: 'auto' });
    } else {
      readerViewport.scrollBy({ left: pageWidth, behavior: 'auto' });
    }
  } else if (onNextChapter) {
    onNextChapter();
  }
}

export function navigateBackward(
  readerViewport: HTMLDivElement,
  readerState: ReaderState,
  onPrevChapter?: () => void
): void {
  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0) return;
  const currentSpread = readerState.currentPageSpread;

  if (currentSpread > 0) {
    const targetSpread = currentSpread - 1;
    if (typeof readerViewport.scrollTo === 'function') {
      readerViewport.scrollTo({ left: targetSpread * pageWidth, behavior: 'auto' });
    } else {
      readerViewport.scrollBy({ left: -pageWidth, behavior: 'auto' });
    }
  } else if (onPrevChapter) {
    onPrevChapter();
  }
}

export function handleModalFocusTrap(e: KeyboardEvent, activeModal: HTMLElement): void {
  if (e.key !== 'Tab') return;

  const focusable = activeModal.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  const focusableList = Array.from(focusable);
  const visibleFocusable = focusableList.filter((el) => {
    if (el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0) return true;
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }
    return true;
  });

  const candidates = visibleFocusable.length > 0 ? visibleFocusable : focusableList;
  if (candidates.length === 0) return;

  const first = candidates[0];
  const last = candidates[candidates.length - 1];

  if (e.shiftKey) {
    if (document.activeElement === first || !activeModal.contains(document.activeElement)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last || !activeModal.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  }
}

export function handleKeyboardEvent(e: KeyboardEvent, options: NavigationOptions): void {
  const { modals, readerViewport, readerState } = options;

  const modalList = [modals.aboutModal, modals.qrModal, modals.discoverPanel, modals.settingsPanel].filter(
    (m): m is HTMLElement => Boolean(m && m.classList.contains('visible'))
  );

  const activeModal = modalList[0];

  if (activeModal) {
    if (e.key === 'Escape') {
      modals.aboutModal?.classList.remove('visible');
      if (modals.onCloseQR) modals.onCloseQR();
      else modals.qrModal?.classList.remove('visible');

      if (modals.onCloseDiscover) modals.onCloseDiscover();
      else {
        modals.discoverPanel?.classList.remove('visible');
        modals.discoverOverlay?.classList.remove('visible');
      }

      modals.settingsPanel?.classList.remove('visible');
      return;
    }

    if (e.key === 'Tab') {
      handleModalFocusTrap(e, activeModal);
    }
    return;
  }

  if (readerState.currentView !== 'reader') return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  if (e.key === 'ArrowLeft' || (e.key === ' ' && e.shiftKey)) {
    e.preventDefault();
    navigateBackward(readerViewport, readerState, options.onPrevChapter);
  } else if (e.key === 'ArrowRight' || (e.key === ' ' && !e.shiftKey)) {
    e.preventDefault();
    navigateForward(readerViewport, readerState, options.onNextChapter);
  }
}

export function handleContentLinkClick(
  e: MouseEvent,
  readerContent: HTMLElement,
  readerViewport: HTMLDivElement,
  readerState: ReaderState,
  onNavigateToChapterAnchor?: (chapterIndex: number, anchorId: string) => void,
  chapters?: Array<{ id: string; htmlContent?: string }>
): void {
  const targetLink = (e.target as HTMLElement).closest('a');
  if (!targetLink) return;

  const href = targetLink.getAttribute('href');
  if (!href) return;

  // External links (http:// or https://)
  if (/^https?:\/\//i.test(href)) {
    e.preventDefault();
    e.stopPropagation();
    window.open(href, '_blank', 'noopener,noreferrer');
    return;
  }

  // Internal book anchor / section links
  e.preventDefault();
  e.stopPropagation();

  const anchorId = href.startsWith('#') ? href.slice(1) : href.includes('#') ? href.split('#')[1] : href;
  if (!anchorId) return;

  const targetEl = resolveChapterElement(readerContent, anchorId);
  if (targetEl && readerState.totalPagesSpreads > 0) {
    const targetSpread = getElementSpreadIndex(targetEl, readerViewport, readerState.totalPagesSpreads);
    const pageWidth = readerViewport.clientWidth;
    if (pageWidth > 0) {
      readerViewport.scrollTo({
        left: targetSpread * pageWidth,
        behavior: 'smooth'
      });
    }
    return;
  }

  // If not found in current DOM, check if it points to another chapter
  if (onNavigateToChapterAnchor) {
    // 1. Check for prefixed c<idx>_ or ch-<idx>
    const matchPrefix = anchorId.match(/^(?:c|ch-)(\d+)(?:_.*)?$/);
    if (matchPrefix) {
      const targetChapterIndex = parseInt(matchPrefix[1], 10);
      onNavigateToChapterAnchor(targetChapterIndex, anchorId);
      return;
    }

    // 2. Search chapters list if available
    if (chapters && chapters.length > 0) {
      const targetIdx = chapters.findIndex(
        (c) =>
          c.id === anchorId ||
          (c.htmlContent &&
            (c.htmlContent.includes(`id="${anchorId}"`) ||
              c.htmlContent.includes(`id='${anchorId}'`) ||
              c.htmlContent.includes(`name="${anchorId}"`) ||
              c.htmlContent.includes(`name='${anchorId}'`)))
      );
      if (targetIdx !== -1) {
        onNavigateToChapterAnchor(targetIdx, anchorId);
      }
    }
  }
}
