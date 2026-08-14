// --- Discover & Search GUI Component ---
import { fetchWithTimeout } from '../services/api.js';
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
    .slice(0, 20);

  if (matches.length > 0) {
    renderCatalogCards(matches, container, `Matching Classics (${matches.length})`, onImportBook);
  } else {
    container.innerHTML = `<div class="discover-loading">Searching Project Gutenberg repository online...</div>`;
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

export async function searchGutenberg(
  query: string,
  resultsContainer: HTMLDivElement,
  catalog: CatalogBook[],
  _state: DiscoverState,
  onImportBook: (bookId: string, title: string, author: string, htmlUrl?: string) => void
): Promise<void> {
  // First search local top 1,000 catalog
  renderLocalCatalogResults(query, catalog, resultsContainer, onImportBook);

  // If query is provided, also query Gutendex API for comprehensive results
  if (query.trim().length > 2) {
    const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
    try {
      const res = await fetchWithTimeout(url, { timeout: 8000 });
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          const apiResults = data.results.map((item: any) => ({
            id: String(item.id),
            title: item.title,
            author: item.authors.map((a: any) => a.name).join(', ') || 'Unknown Author',
            htmlUrl:
              item.formats['text/html'] ||
              item.formats['text/html; charset=utf-8'] ||
              item.formats['text/plain; charset=utf-8'] ||
              item.formats['text/plain']
          }));

          // Merge results if local catalog had fewer than 5 matches
          const existingIds = new Set(catalog.map((b) => b.id));
          const newApiResults = apiResults.filter((b: any) => !existingIds.has(b.id));

          if (newApiResults.length > 0) {
            const combinedHtml =
              resultsContainer.innerHTML +
              `<div style="font-weight: 600; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 16px; margin-bottom: 8px;">Gutenberg Online Repository</div>` +
              newApiResults
                .map(
                  (b: any) => `
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
            resultsContainer.innerHTML = combinedHtml;

            resultsContainer.querySelectorAll('.btn-discover-import').forEach((btn) => {
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
        }
      }
    } catch (_) {}
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
