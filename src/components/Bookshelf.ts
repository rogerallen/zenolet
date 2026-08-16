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
  container: HTMLElement,
  siteTitle?: string,
  curator?: CuratorConfig
): void {
  const title = siteTitle || 'Zenolet';
  const name = curator?.name || 'Roger Allen';

  container.innerHTML = `
    <div class="minimal-header">
      <h1 class="minimal-site-title">${escapeHtml(title)}</h1>
      <p class="minimal-byline">Curated by ${escapeHtml(name)}</p>
    </div>
  `;
}

export function render8SlotGrid(
  gridContainer: HTMLElement,
  storedSlots: (BookMetadata | null)[],
  maxSlots: number = 8,
  onOpenBook: (bookId: string, slotIndex: number) => void,
  onRemoveBook: (bookId: string, slotIndex: number) => void,
  onEmptySlotClick: (slotIndex: number) => void
): void {
  let html = '';

  for (let i = 0; i < maxSlots; i++) {
    const book = storedSlots[i];
    if (book) {
      const progressFraction = getStoredProgress(book.id);
      let progressHtml = '';
      if (progressFraction !== null && progressFraction > 0) {
        const pct = Math.round(progressFraction * 100);
        progressHtml = `
          <div class="slot-progress-bar-container" title="${pct}% read">
            <span class="slot-progress-text">${pct >= 99 ? 'Finished 🎉' : `${pct}% read`}</span>
            <div class="slot-progress-bar">
              <div class="slot-progress-fill" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }

      html += `
        <div class="slot-card slot-filled" data-book-id="${escapeHtml(book.id)}" data-slot-index="${i}">
          <button class="btn-remove-slot" data-book-id="${escapeHtml(book.id)}" data-slot-index="${i}" title="Remove book from Slot ${i + 1}" aria-label="Remove book">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <div class="slot-card-content">
            <h3 class="slot-card-title">${escapeHtml(book.title)}</h3>
            <p class="slot-card-author">by ${escapeHtml(book.author)}</p>
          </div>
          ${progressHtml}
        </div>
      `;
    } else {
      html += `
        <div class="slot-card slot-empty" data-slot-index="${i}" title="Click to add a book to Slot ${i + 1}">
          <div class="slot-empty-body">
            <span class="slot-plus-icon">+</span>
            <span class="slot-empty-label">Add Book</span>
            <span class="slot-sub-text">Slot ${i + 1}</span>
          </div>
        </div>
      `;
    }
  }

  gridContainer.innerHTML = html;

  // Interactivity
  gridContainer.querySelectorAll('.slot-filled').forEach((card) => {
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.btn-remove-slot, .btn-trash-slot')) return;
      const id = card.getAttribute('data-book-id');
      const idx = parseInt(card.getAttribute('data-slot-index') || '0', 10);
      if (id) onOpenBook(id, idx);
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

  gridContainer.querySelectorAll('.slot-empty').forEach((card) => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.getAttribute('data-slot-index') || '0', 10);
      onEmptySlotClick(idx);
    });
  });
}
