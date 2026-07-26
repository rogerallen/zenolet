import type { CatalogBook } from '../services/catalog.js';
import type { CuratorConfig } from '../services/config.js';
import { getStoredProgress, type BookMetadata } from '../services/storage.js';

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderCuratorHeader(
  container: HTMLDivElement,
  siteTitle?: string,
  curator?: CuratorConfig
): void {
  if (!curator && !siteTitle) return;

  const title = siteTitle || 'Zenolet Micro-Library';
  const name = curator?.name || 'Anonymous Curator';
  const bio = curator?.bio || 'A curated selection of timeless public domain literature.';
  const avatar = curator?.avatar || 'https://github.com/github.png';
  const link = curator?.link;

  container.innerHTML = `
    <div class="curator-card">
      <div class="curator-avatar-wrapper">
        <img src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" class="curator-avatar" onerror="this.src='icon.svg'"/>
      </div>
      <div class="curator-details">
        <h1 class="site-title">${escapeHtml(title)}</h1>
        <div class="curator-byline">
          Curated by 
          ${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(name)}</a>` : `<span>${escapeHtml(name)}</span>`}
        </div>
        <p class="curator-bio">${escapeHtml(bio)}</p>
      </div>
    </div>
  `;
}

export function renderGenrePills(
  container: HTMLDivElement,
  genres: string[],
  activeGenre: string,
  onSelectGenre: (genre: string) => void
): void {
  const allPills = ['All', ...genres];
  container.innerHTML = allPills
    .map((g) => {
      const activeClass = g.toLowerCase() === activeGenre.toLowerCase() ? 'active' : '';
      return `<button class="genre-pill ${activeClass}" data-genre="${escapeHtml(g)}">${escapeHtml(g)}</button>`;
    })
    .join('');

  container.querySelectorAll('.genre-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const genre = btn.getAttribute('data-genre') || 'All';
      onSelectGenre(genre);
    });
  });
}

export function renderBookshelf(
  books: CatalogBook[],
  downloadedBooks: Set<string>,
  gridContainer: HTMLDivElement,
  countDisplay: HTMLSpanElement,
  onOpenBook: (book: CatalogBook) => void,
  onToggleOffline: (book: CatalogBook) => void
): void {
  const isOffline = !navigator.onLine;
  countDisplay.textContent = `${books.length} title${books.length === 1 ? '' : 's'}`;

  if (books.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-shelf-placeholder">
        <p>No titles match your search or filter.</p>
        <p class="hint">Try clearing your search query or picking another category.</p>
      </div>
    `;
    return;
  }

  let html = '';
  if (isOffline) {
    html += `<div class="offline-shelf-indicator">📂 Offline Mode — Displaying cached titles available for off-grid reading</div>`;
  }

  html += books
    .map((book) => {
      const isDownloaded = downloadedBooks.has(book.id);
      const downloadIcon = isDownloaded ? '💾' : '📥';
      const downloadClass = isDownloaded ? 'downloaded' : '';
      const downloadTitle = isDownloaded ? 'Stored Offline (Click to remove)' : 'Download for Offline';
      const badgeText = isDownloaded ? '<span class="offline-ready-badge">✓ Cached</span>' : '';

      const progressFraction = getStoredProgress(book.id);
      let progressHtml = '';
      if (progressFraction !== null && progressFraction > 0) {
        const pct = Math.round(progressFraction * 100);
        progressHtml = `
          <div class="card-progress-container" title="${pct}% read">
            <span class="card-progress-text">${pct >= 99 ? 'Finished 🎉' : `${pct}% read`}</span>
            <div class="card-progress-bar">
              <div class="card-progress-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }

      const subjectsBadge = book.subjects.length > 0 
        ? `<span class="book-subject-tag">${escapeHtml(book.subjects[0].split('--')[0])}</span>` 
        : '';

      return `
        <div class="book-card" data-book-id="${escapeHtml(book.id)}">
          <div class="book-card-meta">
            <h3 class="book-card-title">${escapeHtml(book.title)}</h3>
            <p class="book-card-author">by ${escapeHtml(book.author)}</p>
          </div>
          ${progressHtml}
          <div class="book-card-footer">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              ${subjectsBadge}
              ${badgeText}
            </div>
            <button class="btn-card-action ${downloadClass}" data-book-id="${escapeHtml(book.id)}" title="${downloadTitle}" aria-label="${downloadTitle}">
              ${downloadIcon}
            </button>
          </div>
        </div>
      `;
    })
    .join('');

  gridContainer.innerHTML = html;

  gridContainer.querySelectorAll('.book-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-book-id');
      const book = books.find((b) => b.id === id);
      if (book) {
        onOpenBook(book);
      }
    });
  });

  gridContainer.querySelectorAll('.btn-card-action').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-book-id');
      const book = books.find((b) => b.id === id);
      if (book) {
        onToggleOffline(book);
      }
    });
  });
}

export function renderCachedBooksShelf(
  gridContainer: HTMLDivElement,
  countBadge: HTMLSpanElement,
  cachedBooks: BookMetadata[],
  maxLimit: number,
  onOpenBook: (bookId: string) => void,
  onRemoveBook: (bookId: string) => void
): void {
  countBadge.textContent = `${cachedBooks.length} / ${maxLimit} cached`;

  if (cachedBooks.length === 0) {
    gridContainer.innerHTML = `
      <div class="cached-empty-placeholder">
        <span>📖 No books saved for offline reading yet. Click 📥 on any title below to store up to ${maxLimit} books locally.</span>
      </div>
    `;
    return;
  }

  gridContainer.innerHTML = cachedBooks
    .map((book) => {
      const progressFraction = getStoredProgress(book.id);
      let progressPct = '';
      if (progressFraction !== null && progressFraction > 0) {
        const pct = Math.round(progressFraction * 100);
        progressPct = `<span class="cached-progress-badge">${pct}% read</span>`;
      }

      return `
        <div class="cached-book-card" data-book-id="${escapeHtml(book.id)}">
          <div class="cached-book-header">
            <h4 class="cached-book-title">${escapeHtml(book.title)}</h4>
            <button class="btn-remove-cached" data-book-id="${escapeHtml(book.id)}" title="Remove from offline cache">&times;</button>
          </div>
          <p class="cached-book-author">by ${escapeHtml(book.author)}</p>
          <div class="cached-book-footer">
            <span class="cached-status">✓ Offline</span>
            ${progressPct}
          </div>
        </div>
      `;
    })
    .join('');

  gridContainer.querySelectorAll('.cached-book-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-book-id');
      if (id) onOpenBook(id);
    });
  });

  gridContainer.querySelectorAll('.btn-remove-cached').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-book-id');
      if (id) onRemoveBook(id);
    });
  });
}
