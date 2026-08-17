// --- Discover & Search GUI Component (Curated Offline Catalog Only) ---
import type { CatalogBook } from '../services/catalog.js';

export interface DiscoverState {
  nextUrl: string | null;
  previousUrl: string | null;
  totalCount: number;
  currentPage: number;
  importedIds: Set<string>;
}

export function openDiscoverPanel(overlay: HTMLDivElement, panel: HTMLElement): void {
  overlay.classList.add('visible');
  panel.classList.add('visible');
}

export function closeDiscoverPanel(overlay: HTMLDivElement, panel: HTMLElement): void {
  overlay.classList.remove('visible');
  panel.classList.remove('visible');
}

export function showDiscoverEmpty(container: HTMLDivElement, message: string): void {
  container.innerHTML = `
    <div class="discover-empty">
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

export function renderLocalCatalogResults(
  query: string,
  catalog: CatalogBook[],
  container: HTMLDivElement,
  onImportBook: (bookId: string, title: string, author: string, htmlUrl?: string) => void
): void {
  if (!query.trim()) {
    // Render top 15 popular books if query is empty
    const popular = catalog.slice(0, 15);
    renderCatalogCards(popular, container, 'Popular Classics', onImportBook);
    return;
  }

  const q = query.toLowerCase().trim();
  const matches = catalog
    .filter((b) => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q) || b.subjects.some((s) => s.toLowerCase().includes(q)))
    .slice(0, 30);

  if (matches.length > 0) {
    renderCatalogCards(matches, container, `Matching Classics (${matches.length})`, onImportBook);
  } else {
    showDiscoverEmpty(container, 'No matching books found in the curated classics catalog.');
  }
}

function renderCatalogCards(
  books: CatalogBook[],
  container: HTMLDivElement,
  sectionTitle: string,
  onImportBook: (bookId: string, title: string, author: string, htmlUrl?: string) => void
): void {
  let html = `<div style="font-weight: 600; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">${escapeHtml(sectionTitle)}</div>`;

  html += books
    .map(
      (b) => `
      <div class="discover-card">
        <div class="discover-card-info">
          <h4 class="discover-title">#${escapeHtml(b.id)} — ${escapeHtml(b.title)}</h4>
          <p class="discover-author">by ${escapeHtml(b.author)}</p>
        </div>
        <button class="btn-discover-import" 
                data-id="${escapeHtml(b.id)}" 
                data-title="${escapeHtml(b.title)}" 
                data-author="${escapeHtml(b.author)}" 
                data-url="${escapeHtml(b.htmlUrl || '')}">
          + Add to Shelf
        </button>
      </div>
    `
    )
    .join('');

  container.innerHTML = html;

  container.querySelectorAll('.btn-discover-import').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');
      const author = btn.getAttribute('data-author');
      const url = btn.getAttribute('data-url');

      if (id && title && author) {
        onImportBook(id, title, author, url || undefined);
      }
    });
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
