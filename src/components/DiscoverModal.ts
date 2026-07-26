// --- Discover & Import Modal Component ---
import { fetchWithTimeout } from '../services/api.js';

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
      <p>${message}</p>
    </div>
  `;
}

export async function searchGutenberg(
  query: string,
  resultsContainer: HTMLDivElement,
  state: DiscoverState,
  onImportBook: (bookId: string, title: string, author: string, htmlUrl: string) => void
): Promise<void> {
  const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
  await searchGutenbergByUrl(url, resultsContainer, state, onImportBook);
}

export async function searchGutenbergByUrl(
  url: string,
  resultsContainer: HTMLDivElement,
  state: DiscoverState,
  onImportBook: (bookId: string, title: string, author: string, htmlUrl: string) => void
): Promise<void> {
  resultsContainer.innerHTML = `<div class="discover-loading">Searching Project Gutenberg...</div>`;

  try {
    const res = await fetchWithTimeout(url, { timeout: 8000 });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const data = await res.json();

    state.nextUrl = data.next;
    state.previousUrl = data.previous;
    state.totalCount = data.count || 0;

    if (!data.results || data.results.length === 0) {
      showDiscoverEmpty(resultsContainer, 'No Project Gutenberg titles found for your search.');
      return;
    }

    renderDiscoverResults(data.results, resultsContainer, state, onImportBook);
  } catch (err) {
    showDiscoverEmpty(resultsContainer, 'Failed to fetch titles from Gutendex API. Check your connection.');
  }
}

function renderDiscoverResults(
  results: Array<{
    id: number;
    title: string;
    authors: Array<{ name: string }>;
    formats: Record<string, string>;
  }>,
  container: HTMLDivElement,
  state: DiscoverState,
  onImportBook: (bookId: string, title: string, author: string, htmlUrl: string) => void
): void {
  const html = results
    .map((item) => {
      const bookId = String(item.id);
      const author = item.authors.map((a) => a.name).join(', ') || 'Unknown Author';
      const htmlUrl =
        item.formats['text/html'] ||
        item.formats['text/html; charset=utf-8'] ||
        item.formats['text/plain; charset=utf-8'] ||
        item.formats['text/plain'];

      const isImported = state.importedIds.has(bookId);

      return `
        <div class="discover-card">
          <div class="discover-card-info">
            <h4 class="discover-title">#${bookId} — ${escapeHtml(item.title)}</h4>
            <p class="discover-author">by ${escapeHtml(author)}</p>
          </div>
          <button class="btn-discover-import ${isImported ? 'imported' : ''}" 
                  data-id="${bookId}" 
                  data-title="${escapeHtml(item.title)}" 
                  data-author="${escapeHtml(author)}" 
                  data-url="${escapeHtml(htmlUrl || '')}">
            ${isImported ? 'Read' : 'Read Title'}
          </button>
        </div>
      `;
    })
    .join('');

  container.innerHTML = html;

  container.querySelectorAll('.btn-discover-import').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');
      const author = btn.getAttribute('data-author');
      const url = btn.getAttribute('data-url');

      if (id && title && author) {
        state.importedIds.add(id);
        onImportBook(id, title, author, url || '');
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
