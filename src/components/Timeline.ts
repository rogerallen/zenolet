// --- Timeline Component for Zenolet ---

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
  const targetEl = readerContent.querySelector(`[id="${id}"], [name="${id}"]`) as HTMLElement;
  if (!targetEl) return null;

  if (targetEl.tagName === 'A' || targetEl.tagName === 'SPAN') {
    const heading =
      targetEl.closest('h1, h2, h3, h4') ||
      (targetEl.nextElementSibling && targetEl.nextElementSibling.matches('h1, h2, h3, h4, div, section, p')
        ? (targetEl.nextElementSibling as HTMLElement)
        : null);
    if (heading && heading instanceof HTMLElement) {
      return heading;
    }
  }
  return targetEl;
}

export function getChapterMarkers(
  readerContent: HTMLElement,
  readerViewport: HTMLDivElement,
  totalPagesSpreads: number
): ChapterMarker[] {
  const markers: ChapterMarker[] = [];
  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0) return markers;

  const tocTable = readerContent.querySelector('table[data-summary="contents"], table[summary="contents"]');
  const tocLinks = tocTable ? Array.from(tocTable.querySelectorAll('a[href^="#"]')) : [];

  const seenIds = new Set<string>();

  tocLinks.forEach((el) => {
    const a = el as HTMLAnchorElement;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    const id = href.substring(1);
    if (!id || seenIds.has(id)) return;

    const rawTarget = readerContent.querySelector(`[id="${id}"], [name="${id}"]`) as HTMLElement;
    if (!rawTarget) return;

    const resolvedEl = resolveChapterElement(readerContent, id) || rawTarget;

    let title = '';
    const row = a.closest('tr');
    if (row) {
      const textCol = row.querySelector('.tdl, td:nth-child(2)');
      title = textCol?.textContent?.trim() || '';
    }
    if (!title) {
      const heading = rawTarget.closest('h1, h2, h3, h4') || resolvedEl.closest('h1, h2, h3, h4');
      title = heading?.textContent?.trim() || rawTarget.parentElement?.textContent?.trim() || '';
    }

    title = title
      .replace(/^[—\-\s\d.•·:~]+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!title) title = id;

    const pageSpread = getElementSpreadIndex(resolvedEl, readerViewport, totalPagesSpreads);

    seenIds.add(id);
    markers.push({ id, title, pageSpread });
  });

  if (markers.length === 0) {
    const headings = Array.from(
      readerContent.querySelectorAll('h1, h2, h3, [id^="chap"], [id^="chapter"], .chapter h2, .chapter h3')
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
      if (seenTexts.has(cleanText)) return;

      if (/contents|illustrations|title page/i.test(cleanText)) return;

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

  const markers = getChapterMarkers(readerContent, readerViewport, totalPagesSpreads);

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

export function renderTimeline(
  readerContent: HTMLElement,
  readerViewport: HTMLDivElement,
  totalPagesSpreads: number,
  onJumpToSpread: (spreadIndex: number) => void
): void {
  const timelineTicks = document.getElementById('timeline-ticks');
  if (!timelineTicks) return;
  timelineTicks.innerHTML = '';

  const pageWidth = readerViewport.clientWidth;
  if (pageWidth <= 0 || totalPagesSpreads <= 1) return;

  const progressTrack = document.getElementById('progress-track');
  if (progressTrack) {
    progressTrack.onclick = (e: MouseEvent) => {
      const rect = progressTrack.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      const targetSpread = Math.round(ratio * (totalPagesSpreads - 1));
      onJumpToSpread(targetSpread);
    };
  }

  const beginDot = document.createElement('div');
  beginDot.className = 'timeline-dot begin-dot';
  beginDot.style.left = '0%';
  beginDot.title = 'Begin';
  beginDot.addEventListener('click', (e) => {
    e.stopPropagation();
    onJumpToSpread(0);
  });
  timelineTicks.appendChild(beginDot);

  const endDot = document.createElement('div');
  endDot.className = 'timeline-dot end-dot';
  endDot.style.left = '100%';
  endDot.title = 'End';
  endDot.addEventListener('click', (e) => {
    e.stopPropagation();
    onJumpToSpread(totalPagesSpreads - 1);
  });
  timelineTicks.appendChild(endDot);

  const markers = getChapterMarkers(readerContent, readerViewport, totalPagesSpreads);
  markers.forEach((marker) => {
    if (marker.pageSpread <= 0 || marker.pageSpread >= totalPagesSpreads - 1) return;

    const percent = (marker.pageSpread / (totalPagesSpreads - 1)) * 100;
    const dot = document.createElement('div');
    dot.className = 'timeline-dot chapter-dot';
    dot.style.left = `${percent}%`;
    dot.title = marker.title;

    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      onJumpToSpread(marker.pageSpread);
    });

    timelineTicks.appendChild(dot);
  });
}
