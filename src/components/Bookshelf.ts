import type { CuratorConfig } from '../services/config.js';
import { getStoredProgress, formatBytes, type BookMetadata } from '../services/storage.js';

export function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderCuratorHeader(
  container: HTMLElement,
  siteTitle?: string,
  curator?: CuratorConfig,
  blurb?: string
): void {
  const title = siteTitle || 'Zenolet';
  const name = curator?.name || 'Curator';
  const rawUrl = curator?.linkUrl?.trim() || '';
  const isSafeUrl = /^https?:\/\//i.test(rawUrl);
  const curatorHtml = isSafeUrl
    ? `<a href="${escapeHtml(rawUrl)}" target="_blank" rel="noopener" class="curator-link">${escapeHtml(name)}</a>`
    : escapeHtml(name);

  let formattedBlurb = escapeHtml(blurb || '');
  if (formattedBlurb.includes('Project Gutenberg')) {
    formattedBlurb = formattedBlurb.replace(
      /Project Gutenberg/g,
      '<a href="https://www.gutenberg.org" target="_blank" rel="noopener" class="curator-link">Project Gutenberg</a>'
    );
  }

  const blurbHtml = formattedBlurb ? `<p class="minimal-blurb">${formattedBlurb}</p>` : '';

  container.innerHTML = `
    <div class="minimal-header">
      <h1 class="minimal-site-title">${escapeHtml(title)}</h1>
      ${blurbHtml}
      <p class="minimal-byline">Curated by ${curatorHtml}</p>
    </div>
  `;
}

export function renderAboutLibrarySection(
  container: HTMLElement,
  siteTitle?: string,
  curator?: CuratorConfig,
  blurb?: string
): void {
  const title = siteTitle || 'Curated Library';
  const name = curator?.name || 'Curator';
  const rawUrl = curator?.linkUrl?.trim() || '';
  const isSafeUrl = /^https?:\/\//i.test(rawUrl);
  const curatorHtml = isSafeUrl
    ? `<a href="${escapeHtml(rawUrl)}" target="_blank" rel="noopener" class="curator-link">${escapeHtml(name)}</a>`
    : escapeHtml(name);

  let formattedBlurb = escapeHtml(blurb || '');
  if (formattedBlurb.includes('Project Gutenberg')) {
    formattedBlurb = formattedBlurb.replace(
      /Project Gutenberg/g,
      '<a href="https://www.gutenberg.org" target="_blank" rel="noopener" class="curator-link">Project Gutenberg</a>'
    );
  }

  const blurbHtml = formattedBlurb ? `<p class="about-library-blurb">${formattedBlurb}</p>` : '';

  container.innerHTML = `
    <div class="about-library-section">
      <h4 class="about-library-title">${escapeHtml(title)}</h4>
      ${blurbHtml}
      <p class="about-library-curator">Curated by ${curatorHtml}</p>
    </div>
  `;
}

export interface LoadingSlotState {
  slotIndex: number;
  book?: BookMetadata | null;
}

export function render8SlotGrid(
  gridContainer: HTMLElement,
  storedSlots: (BookMetadata | null)[],
  _maxSlots: number = 8,
  onOpenBook: (bookId: string, slotIndex: number) => void,
  onRemoveBook: (bookId: string, slotIndex: number) => void,
  onEmptySlotClick: (slotIndex: number) => void,
  loadingSlot?: LoadingSlotState | null
): void {
  const activeBooks = (storedSlots || []).filter(
    (b): b is BookMetadata => b !== null && typeof b === 'object' && Boolean(b.id)
  );
  let html = '';

  for (let i = 0; i < activeBooks.length; i++) {
    const isLoadingThisSlot = loadingSlot && loadingSlot.slotIndex === i;
    const book = isLoadingThisSlot && loadingSlot.book ? loadingSlot.book : activeBooks[i];

    if (isLoadingThisSlot) {
      const coverUrl = book.coverUrl;
      const coverHtml = coverUrl
        ? `
          <div class="slot-cover-wrap">
            <img class="slot-cover-img" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(book.title)} cover" loading="lazy" />
          </div>
        `
        : `
          <div class="slot-cover-wrap slot-cover-placeholder">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
        `;

      html += `
        <div class="slot-card slot-filled slot-loading" data-slot-index="${i}">
          <div class="slot-card-body">
            ${coverHtml}
            <div class="slot-card-content">
              <h3 class="slot-card-title">${escapeHtml(book.title)}</h3>
              <p class="slot-card-author">by ${escapeHtml(book.author)}</p>
            </div>
          </div>
          <div class="slot-loading-indicator">
            <div class="slot-spinner"></div>
            <span class="slot-loading-text">Downloading...</span>
          </div>
        </div>
      `;
      continue;
    }

    const progressFraction = getStoredProgress(book.id);
    const pct = progressFraction !== null ? Math.round(progressFraction * 100) : 0;
    const sizeStr = formatBytes(book.byteSize);
    const progressHtml = `
      <div class="slot-progress-bar-container" title="${pct}% read${sizeStr ? ` • ${sizeStr}` : ''}">
        <div class="slot-progress-header">
          <span class="slot-progress-text">${pct >= 99 ? 'Finished 🎉' : `${pct}% read`}</span>
          ${sizeStr ? `<span class="slot-size-text">${escapeHtml(sizeStr)}</span>` : ''}
        </div>
        <div class="slot-progress-bar">
          <div class="slot-progress-fill" style="width: ${pct}%"></div>
        </div>
      </div>
    `;

    const coverUrl = book.coverUrl;
    const coverHtml = coverUrl
      ? `
        <div class="slot-cover-wrap">
          <img class="slot-cover-img" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(book.title)} cover" loading="lazy" />
        </div>
      `
      : `
        <div class="slot-cover-wrap slot-cover-placeholder">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
        </div>
      `;

    html += `
      <div class="slot-card slot-filled" data-book-id="${escapeHtml(book.id)}" data-slot-index="${i}" tabindex="0" role="button" aria-label="Read ${escapeHtml(book.title)} by ${escapeHtml(book.author)}">
        <button class="btn-remove-slot" data-book-id="${escapeHtml(book.id)}" data-slot-index="${i}" title="Remove ${escapeHtml(book.title)}" aria-label="Remove ${escapeHtml(book.title)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        <div class="slot-card-body">
          ${coverHtml}
          <div class="slot-card-content">
            <h3 class="slot-card-title">${escapeHtml(book.title)}</h3>
            <p class="slot-card-author">by ${escapeHtml(book.author)}</p>
          </div>
        </div>
        ${progressHtml}
      </div>
    `;
  }

  // Render exactly one trailing slot: loading slot if active, or empty Add Book trigger
  const nextSlotIndex = activeBooks.length;
  const isLoadingNext = loadingSlot && loadingSlot.slotIndex >= nextSlotIndex;

  if (isLoadingNext) {
    const book = loadingSlot.book;
    if (book) {
      const coverUrl = book.coverUrl;
      const coverHtml = coverUrl
        ? `
          <div class="slot-cover-wrap">
            <img class="slot-cover-img" src="${escapeHtml(coverUrl)}" alt="${escapeHtml(book.title)} cover" loading="lazy" />
          </div>
        `
        : `
          <div class="slot-cover-wrap slot-cover-placeholder">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
        `;

      html += `
        <div class="slot-card slot-filled slot-loading" data-slot-index="${nextSlotIndex}">
          <div class="slot-card-body">
            ${coverHtml}
            <div class="slot-card-content">
              <h3 class="slot-card-title">${escapeHtml(book.title)}</h3>
              <p class="slot-card-author">by ${escapeHtml(book.author)}</p>
            </div>
          </div>
          <div class="slot-loading-indicator">
            <div class="slot-spinner"></div>
            <span class="slot-loading-text">Downloading...</span>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="slot-card slot-empty slot-loading" data-slot-index="${nextSlotIndex}">
          <div class="slot-empty-body">
            <div class="slot-spinner"></div>
            <span class="slot-empty-label">Downloading...</span>
          </div>
        </div>
      `;
    }
  } else {
    html += `
      <div class="slot-card slot-empty" data-slot-index="${nextSlotIndex}" tabindex="0" role="button" aria-label="Add Book" title="Click to add a book to your bookshelf">
        <div class="slot-empty-body">
          <span class="slot-plus-icon">+</span>
          <span class="slot-empty-label">Add Book</span>
        </div>
      </div>
    `;
  }

  gridContainer.innerHTML = html;

  // Interactivity
  gridContainer.querySelectorAll('.slot-filled:not(.slot-loading)').forEach((card) => {
    const handleOpen = (e: Event) => {
      if ((e.target as HTMLElement).closest('.btn-remove-slot, .btn-trash-slot')) return;
      const id = card.getAttribute('data-book-id');
      const idx = parseInt(card.getAttribute('data-slot-index') || '0', 10);
      if (id) onOpenBook(id, idx);
    };

    card.addEventListener('click', handleOpen);
    card.addEventListener('keydown', (e) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        keyboardEvent.preventDefault();
        handleOpen(e);
      }
    });
  });

  gridContainer.querySelectorAll('.btn-remove-slot, .btn-trash-slot').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-book-id');
      const idx = parseInt(btn.getAttribute('data-slot-index') || '0', 10);
      if (id) onRemoveBook(id, idx);
    });
  });

  gridContainer.querySelectorAll('.slot-empty:not(.slot-loading)').forEach((card) => {
    const handleEmptyClick = () => {
      const idx = parseInt(card.getAttribute('data-slot-index') || '0', 10);
      onEmptySlotClick(idx);
    };

    card.addEventListener('click', handleEmptyClick);
    card.addEventListener('keydown', (e) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        keyboardEvent.preventDefault();
        handleEmptyClick();
      }
    });
  });
}

export const renderBookshelfGrid = render8SlotGrid;
