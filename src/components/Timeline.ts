import type { EpubChapter } from '../services/epub.js';

export interface ChapterMarker {
  id: string;
  title: string;
  pageSpread: number;
}

export function getElementSpreadIndex(
  targetEl: HTMLElement,
  readerViewport: HTMLDivElement,
  totalPagesSpreads: number
): number {
  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0) return 0;

  const targetRect = targetEl.getBoundingClientRect();
  const viewportRect = readerViewport.getBoundingClientRect();

  const absoluteLeft = targetRect.left - viewportRect.left + readerViewport.scrollLeft;
  const spreadIndex = Math.floor(absoluteLeft / pageWidth);

  return Math.min(totalPagesSpreads - 1, Math.max(0, spreadIndex));
}

export function resolveChapterElement(readerContent: HTMLElement, id: string): HTMLElement | null {
  if (!id) return null;
  let targetEl: HTMLElement | null;
  try {
    const escaped = CSS.escape(id);
    targetEl = (readerContent.querySelector(`[id="${escaped}"], [name="${escaped}"]`) as HTMLElement) || null;
  } catch {
    targetEl = (readerContent.querySelector(`[id="${id}"], [name="${id}"]`) as HTMLElement) || null;
  }

  // Fallback 1: If not found directly and id does not start with 'c', try chapter-prefixed instances (e.g. c0_id, c1_id)
  if (!targetEl && !id.startsWith('c')) {
    targetEl = (readerContent.querySelector(`[id$="_${id}"], [name$="_${id}"]`) as HTMLElement) || null;
  }

  // Fallback 2: If id starts with 'c<num>_' and was not found, try raw stripped id
  if (!targetEl && /^c\d+_/.test(id)) {
    const rawId = id.replace(/^c\d+_/, '');
    targetEl = (readerContent.querySelector(`[id="${rawId}"], [name="${rawId}"]`) as HTMLElement) || null;
  }

  if (!targetEl) return null;

  // If targetEl is a heading with text, return it directly
  if (/^H[1-6]$/i.test(targetEl.tagName) && (targetEl.textContent?.trim().length ?? 0) > 0) {
    return targetEl;
  }

  // If targetEl is inside a heading
  const parentHeading = targetEl.closest('h1, h2, h3, h4, h5, h6');
  if (parentHeading && parentHeading instanceof HTMLElement && (parentHeading.textContent?.trim().length ?? 0) > 0) {
    return parentHeading;
  }

  // If targetEl contains a heading
  const childHeading = targetEl.querySelector('h1, h2, h3, h4, h5, h6');
  if (childHeading && childHeading instanceof HTMLElement && (childHeading.textContent?.trim().length ?? 0) > 0) {
    return childHeading;
  }

  // If targetEl is a chapter container or has text content, return it directly
  if (targetEl.classList.contains('epub-chapter') || (targetEl.textContent?.trim().length ?? 0) > 0) {
    return targetEl;
  }

  // If targetEl is an empty anchor or wrapper, forward-walk to the actual chapter heading or text element
  let candidate: Element | null = targetEl;
  if (
    candidate.parentElement &&
    candidate.parentElement !== readerContent &&
    (candidate.parentElement.textContent?.trim() || '') === (candidate.textContent?.trim() || '')
  ) {
    candidate = candidate.parentElement;
  }

  for (let i = 0; i < 8 && candidate; i++) {
    const next: Element | null = candidate.nextElementSibling;
    if (next) {
      if (/^H[1-6]$/i.test(next.tagName) && (next.textContent?.trim().length ?? 0) > 0) {
        return next as HTMLElement;
      }
      const headingInside = next.querySelector('h1, h2, h3, h4, h5, h6');
      if (
        headingInside &&
        headingInside instanceof HTMLElement &&
        (headingInside.textContent?.trim().length ?? 0) > 0
      ) {
        return headingInside;
      }
      if ((next.textContent?.trim().length ?? 0) > 0) {
        return next as HTMLElement;
      }
      candidate = next;
    } else {
      candidate = candidate.parentElement;
      if (candidate === readerContent) break;
    }
  }

  return targetEl;
}

let cachedChapterMarkers: ChapterMarker[] | null = null;

export function invalidateChapterMarkers(): void {
  cachedChapterMarkers = null;
}

export function getChapterMarkers(
  readerContent: HTMLElement,
  readerViewport: HTMLDivElement,
  totalPagesSpreads: number,
  useCache: boolean = false,
  epubChapters?: EpubChapter[]
): ChapterMarker[] {
  if (useCache && cachedChapterMarkers) {
    return cachedChapterMarkers;
  }

  const markers: ChapterMarker[] = [];
  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0) return markers;

  const isPageTitle = (title: string) =>
    /^(page\s*\d+|\d+|p\.\s*\d+|\[\s*page\s*\d+\s*\]|\[\d+\])$/i.test(title.trim()) ||
    /^(list of illustrations|illustrations|cover|title page|colophon|copyright)$/i.test(title.trim());

  // 1. Primary: Use structured EPUB Table of Contents if available
  if (epubChapters && epubChapters.length > 0) {
    const seenIds = new Set<string>();
    for (const ch of epubChapters) {
      if (!ch.anchorId || seenIds.has(ch.anchorId)) continue;
      if (isPageTitle(ch.title)) continue;

      const targetEl = resolveChapterElement(readerContent, ch.anchorId);
      if (targetEl) {
        const pageSpread = getElementSpreadIndex(targetEl, readerViewport, totalPagesSpreads);
        seenIds.add(ch.anchorId);
        markers.push({
          id: ch.anchorId,
          title: ch.title || `Chapter ${markers.length + 1}`,
          pageSpread
        });
      }
    }
  }

  // 2. Fallback: Parse Gutenberg contents table from DOM if no EPUB chapters found
  if (markers.length === 0) {
    const tocTable = readerContent.querySelector('table[data-summary="contents"], table[summary="contents"]');
    const tocLinks = tocTable ? Array.from(tocTable.querySelectorAll('a[href^="#"]')) : [];

    const seenIds = new Set<string>();

    tocLinks.forEach((el) => {
      const a = el as HTMLAnchorElement;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const id = href.substring(1);
      if (!id || seenIds.has(id)) return;

      const resolvedEl = resolveChapterElement(readerContent, id);
      if (!resolvedEl) return;

      let title = '';
      const row = a.closest('tr');
      if (row) {
        const textCol = row.querySelector('.tdl, td:nth-child(2)');
        title = textCol?.textContent?.trim() || '';
      }
      if (!title) {
        const heading =
          resolvedEl.closest('h1, h2, h3, h4') || (resolvedEl.matches('h1, h2, h3, h4') ? resolvedEl : null);
        title = heading?.textContent?.trim() || resolvedEl.parentElement?.textContent?.trim() || '';
      }

      title = title
        .replace(/^[—\-\s\d.•·:~]+/, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!title || isPageTitle(title)) return;

      const pageSpread = getElementSpreadIndex(resolvedEl, readerViewport, totalPagesSpreads);

      seenIds.add(id);
      markers.push({ id, title, pageSpread });
    });
  }

  // 3. Fallback: Query all headings in rendered DOM
  if (markers.length === 0) {
    const headings = Array.from(
      readerContent.querySelectorAll(
        'h1, h2, h3, h4, .chapter > h2, .chapter > h3, .epub-chapter > h1, .epub-chapter > h2, .epub-chapter > h3'
      )
    );
    const seenTexts = new Set<string>();

    headings.forEach((node) => {
      const el = node as HTMLElement;
      const text = el.textContent?.trim();
      if (!text || text.length < 3) return;
      const cleanText = text
        .replace(/^[—\-\s\d.•·:~]+/, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (seenTexts.has(cleanText) || isPageTitle(cleanText)) return;

      const pageSpread = getElementSpreadIndex(el, readerViewport, totalPagesSpreads);
      seenTexts.add(cleanText);

      markers.push({
        id: el.id || `chap-${pageSpread}`,
        title: cleanText,
        pageSpread
      });
    });
  }

  markers.sort((a, b) => a.pageSpread - b.pageSpread);
  cachedChapterMarkers = markers;
  return markers;
}

export function updateActiveChapterLabel(
  readerContent: HTMLElement,
  readerViewport: HTMLDivElement,
  currentPageSpread: number,
  totalPagesSpreads: number
): void {
  const indicator = document.getElementById('active-chapter-indicator');
  if (!indicator) return;

  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0 || totalPagesSpreads <= 1) {
    indicator.textContent = '';
    return;
  }

  if (currentPageSpread === 0) {
    indicator.textContent = 'Begin';
    return;
  }
  if (currentPageSpread === totalPagesSpreads - 1) {
    indicator.textContent = 'End';
    return;
  }

  const markers = cachedChapterMarkers
    ? cachedChapterMarkers
    : getChapterMarkers(readerContent, readerViewport, totalPagesSpreads, true);

  let activeChapterText = '';
  for (let i = 0; i < markers.length; i++) {
    if (markers[i].pageSpread <= currentPageSpread) {
      activeChapterText = markers[i].title;
    } else {
      break;
    }
  }

  indicator.textContent = activeChapterText || 'Reading...';
}

let activePopupElement: HTMLElement | null = null;
let activePopupCleanup: (() => void) | null = null;
let activeTargetSpread: number | null = null;

export function closeChapterPopup(): void {
  activeTargetSpread = null;
  if (activePopupCleanup) {
    activePopupCleanup();
    activePopupCleanup = null;
  }
  if (activePopupElement) {
    activePopupElement.remove();
    activePopupElement = null;
  }
}

export function showChapterPopup(
  markers: ChapterMarker[],
  targetSpread: number,
  currentReadingSpread: number,
  clickClientX: number,
  trackRect: DOMRect,
  totalPagesSpreads: number,
  onJumpToSpread: (spreadIndex: number) => void
): void {
  if (activePopupElement && activeTargetSpread === targetSpread) {
    // Already rendered and displayed for this spread position; avoid glitchy re-rendering
    return;
  }

  closeChapterPopup();
  activeTargetSpread = targetSpread;

  if (!markers || markers.length === 0) return;

  // Find which chapter corresponds to the user's active reading position
  let activeMarkerId: string | null = null;
  for (let i = 0; i < markers.length; i++) {
    if (markers[i].pageSpread <= currentReadingSpread) {
      activeMarkerId = markers[i].id;
    } else {
      break;
    }
  }
  if (!activeMarkerId && markers.length > 0) {
    activeMarkerId = markers[0].id;
  }

  // Find the closest marker index to the clicked target spread
  let closestIdx = 0;
  let minDiff = Infinity;
  for (let i = 0; i < markers.length; i++) {
    const diff = Math.abs(markers[i].pageSpread - targetSpread);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  }

  // Guarantee displaying up to 12-14 chapters centered around the region
  const windowSize = Math.min(14, markers.length);
  const halfWindow = Math.floor(windowSize / 2);
  let startIdx = Math.max(0, closestIdx - halfWindow);
  let endIdx = Math.min(markers.length, startIdx + windowSize);

  if (endIdx - startIdx < windowSize) {
    if (startIdx === 0) {
      endIdx = Math.min(markers.length, windowSize);
    } else if (endIdx === markers.length) {
      startIdx = Math.max(0, markers.length - windowSize);
    }
  }

  const regionMarkers = markers.slice(startIdx, endIdx);
  if (regionMarkers.length === 0) return;

  const popup = document.createElement('div');
  popup.className = 'chapter-popup-menu';
  popup.id = 'chapter-popup-menu';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-label', 'Select Chapter');

  const header = document.createElement('div');
  header.className = 'chapter-popup-header';
  header.innerHTML = `<span>Select Chapter</span><span class="chapter-popup-range">${startIdx + 1}–${endIdx} of ${markers.length}</span>`;
  popup.appendChild(header);

  const list = document.createElement('div');
  list.className = 'chapter-popup-list';

  regionMarkers.forEach((marker) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'chapter-popup-item';

    const isCurrent = marker.id === activeMarkerId;
    if (isCurrent) {
      item.classList.add('current');
    }

    const titleSpan = document.createElement('span');
    titleSpan.className = 'chapter-item-title';
    titleSpan.textContent = marker.title;

    const spreadSpan = document.createElement('span');
    spreadSpan.className = 'chapter-item-spread';
    const percent = Math.round((marker.pageSpread / Math.max(1, totalPagesSpreads - 1)) * 100);
    spreadSpan.textContent = `${percent}%`;

    item.appendChild(titleSpan);
    item.appendChild(spreadSpan);

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      closeChapterPopup();
      onJumpToSpread(marker.pageSpread);
    });

    list.appendChild(item);
  });

  popup.appendChild(list);
  document.body.appendChild(popup);
  activePopupElement = popup;

  // Focus the current active chapter button or first item
  setTimeout(() => {
    const currentBtn =
      popup.querySelector<HTMLElement>('.chapter-popup-item.current') ||
      popup.querySelector<HTMLElement>('.chapter-popup-item');
    currentBtn?.focus();
  }, 40);

  // Positioning logic
  const popupWidth = Math.min(320, window.innerWidth - 32);
  popup.style.width = `${popupWidth}px`;

  const leftPos = Math.max(16, Math.min(window.innerWidth - popupWidth - 16, clickClientX - popupWidth / 2));
  const bottomPos = Math.max(16, window.innerHeight - trackRect.top + 10);

  popup.style.left = `${leftPos}px`;
  popup.style.bottom = `${bottomPos}px`;

  const handlePointerDown = (e: MouseEvent | TouchEvent) => {
    const target = (e instanceof TouchEvent && e.touches[0] ? e.touches[0].target : e.target) as Node;
    if (popup && !popup.contains(target)) {
      closeChapterPopup();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeChapterPopup();
    }
  };

  const handleResize = () => {
    closeChapterPopup();
  };

  setTimeout(() => {
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
  }, 20);

  activePopupCleanup = () => {
    window.removeEventListener('pointerdown', handlePointerDown);
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', handleResize);
  };
}

export function renderTimeline(
  readerContent: HTMLElement,
  readerViewport: HTMLDivElement,
  totalPagesSpreads: number,
  onJumpToSpread: (spreadIndex: number) => void,
  epubChapters?: EpubChapter[]
): void {
  const timelineTicks = document.getElementById('timeline-ticks');
  if (!timelineTicks) return;
  timelineTicks.innerHTML = '';
  closeChapterPopup();

  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0 || totalPagesSpreads <= 1) return;

  const markers = getChapterMarkers(readerContent, readerViewport, totalPagesSpreads, false, epubChapters);

  // Filter markers to avoid overcrowding on books with many chapters (e.g. Moby Dick)
  const minSpreadDistance = Math.max(1, Math.floor(totalPagesSpreads * 0.035));
  const candidateMarkers: ChapterMarker[] = [];
  let lastSpread = -minSpreadDistance;

  markers.forEach((marker) => {
    if (marker.pageSpread <= 0 || marker.pageSpread >= totalPagesSpreads - 1) return;
    if (marker.pageSpread - lastSpread >= minSpreadDistance) {
      candidateMarkers.push(marker);
      lastSpread = marker.pageSpread;
    }
  });

  // Cap maximum chapter dots to 14 to keep timeline clean on mobile & desktop
  const maxDots = 14;
  const step = Math.ceil(candidateMarkers.length / maxDots);
  const displayedMarkers = step > 1 ? candidateMarkers.filter((_, idx) => idx % step === 0) : candidateMarkers;

  const getCurrentReadingSpread = (): number => {
    const pWidth = readerViewport.clientWidth;
    if (pWidth <= 0 || totalPagesSpreads <= 1) return 0;
    return Math.min(totalPagesSpreads - 1, Math.max(0, Math.round(readerViewport.scrollLeft / pWidth)));
  };

  const progressTrack = document.getElementById('progress-track');
  if (progressTrack) {
    let pressTimer: number | null = null;
    let isLongPress = false;
    let longPressResetTimer: number | null = null;
    let startX = 0;
    let startY = 0;

    const startPress = (clientX: number, clientY: number) => {
      if (longPressResetTimer !== null) {
        window.clearTimeout(longPressResetTimer);
        longPressResetTimer = null;
      }
      isLongPress = false;
      startX = clientX;
      startY = clientY;

      if (pressTimer !== null) {
        window.clearTimeout(pressTimer);
      }

      pressTimer = window.setTimeout(() => {
        isLongPress = true;
        pressTimer = null;
        const rect = progressTrack.getBoundingClientRect();
        const clickX = clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const targetSpread = Math.round(ratio * (totalPagesSpreads - 1));
        showChapterPopup(
          markers,
          targetSpread,
          getCurrentReadingSpread(),
          clientX,
          rect,
          totalPagesSpreads,
          onJumpToSpread
        );
      }, 350);
    };

    const cancelPress = () => {
      if (pressTimer !== null) {
        window.clearTimeout(pressTimer);
        pressTimer = null;
      }
    };

    const endPress = (clientX: number) => {
      if (pressTimer !== null) {
        window.clearTimeout(pressTimer);
        pressTimer = null;
      }
      if (!isLongPress) {
        const rect = progressTrack.getBoundingClientRect();
        const clickX = clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const targetSpread = Math.round(ratio * (totalPagesSpreads - 1));
        onJumpToSpread(targetSpread);
      } else {
        // Absorb subsequent synthetic click / contextmenu events from browser
        longPressResetTimer = window.setTimeout(() => {
          isLongPress = false;
          longPressResetTimer = null;
        }, 400);
      }
    };

    progressTrack.onmousedown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      startPress(e.clientX, e.clientY);
    };

    progressTrack.onmousemove = (e: MouseEvent) => {
      if (pressTimer !== null && (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8)) {
        cancelPress();
      }
    };

    progressTrack.onmouseup = (e: MouseEvent) => {
      if (e.button !== 0) return;
      endPress(e.clientX);
    };

    progressTrack.onclick = (e: MouseEvent) => {
      if (isLongPress) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    progressTrack.onmouseleave = () => {
      cancelPress();
    };

    progressTrack.ontouchstart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        startPress(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    progressTrack.ontouchmove = (e: TouchEvent) => {
      if (e.touches.length > 0 && pressTimer !== null) {
        if (Math.abs(e.touches[0].clientX - startX) > 10 || Math.abs(e.touches[0].clientY - startY) > 10) {
          cancelPress();
        }
      }
    };

    progressTrack.ontouchend = (e: TouchEvent) => {
      const clientX = e.changedTouches.length > 0 ? e.changedTouches[0].clientX : startX;
      endPress(clientX);
    };

    progressTrack.ontouchcancel = () => {
      cancelPress();
    };

    progressTrack.oncontextmenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isLongPress) {
        const rect = progressTrack.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const targetSpread = Math.round(ratio * (totalPagesSpreads - 1));
        showChapterPopup(
          markers,
          targetSpread,
          getCurrentReadingSpread(),
          e.clientX,
          rect,
          totalPagesSpreads,
          onJumpToSpread
        );
      }
    };
  }

  const makeAccessibleDot = (dot: HTMLElement, label: string, jumpIndex: number) => {
    dot.tabIndex = 0;
    dot.setAttribute('role', 'button');
    dot.setAttribute('aria-label', label);
    dot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onJumpToSpread(jumpIndex);
      }
    });
  };

  const beginDot = document.createElement('div');
  beginDot.className = 'timeline-dot begin-dot';
  beginDot.style.left = '0%';
  beginDot.title = 'Begin';
  makeAccessibleDot(beginDot, 'Jump to beginning of book', 0);
  beginDot.addEventListener('click', (e) => {
    e.stopPropagation();
    onJumpToSpread(0);
  });
  timelineTicks.appendChild(beginDot);

  const endDot = document.createElement('div');
  endDot.className = 'timeline-dot end-dot';
  endDot.style.left = '100%';
  endDot.title = 'End';
  makeAccessibleDot(endDot, 'Jump to end of book', totalPagesSpreads - 1);
  endDot.addEventListener('click', (e) => {
    e.stopPropagation();
    onJumpToSpread(totalPagesSpreads - 1);
  });
  timelineTicks.appendChild(endDot);

  displayedMarkers.forEach((marker) => {
    const percent = (marker.pageSpread / (totalPagesSpreads - 1)) * 100;
    const dot = document.createElement('div');
    dot.className = 'timeline-dot chapter-dot';
    dot.style.left = `${percent}%`;
    dot.title = marker.title;
    makeAccessibleDot(dot, `Jump to ${marker.title}`, marker.pageSpread);

    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      onJumpToSpread(marker.pageSpread);
    });

    timelineTicks.appendChild(dot);
  });
}
