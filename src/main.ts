import './style.css';
import { marked } from 'marked';
import { loadZenoletConfig, type ZenoletConfig } from './services/config.ts';
import { fetchCatalog, filterCatalog, extractPopularGenres, type CatalogBook } from './services/catalog.ts';
import { buildProxyUrl, getGutenbergCandidateUrls } from './services/corsProxy.ts';
import { encodeState, decodeState, type AppState } from './services/state.ts';
import {
  saveBookOffline,
  getStoredBookOffline,
  removeBookOffline,
  getDownloadedBookSet,
  getDownloadedMetadataList,
  getStoredProgress,
  restoreBookProgressByFraction,
  MAX_OFFLINE_BOOKS
} from './services/storage.ts';
import { renderCuratorHeader, renderGenrePills, renderBookshelf, renderCachedBooksShelf } from './components/Bookshelf.ts';
import {
  setTheme,
  setFontSize,
  recalculatePages,
  updatePaginationIndicator,
  setupDragToScroll,
  type ReaderState
} from './components/ReaderEngine.ts';
import { setupSettingsModal } from './components/SettingsModal.ts';
import { openQRModal, closeQRModal } from './components/QRModal.ts';
import {
  openDiscoverPanel,
  closeDiscoverPanel,
  searchGutenberg,
  type DiscoverState
} from './components/DiscoverModal.ts';

// --- State ---
let config: ZenoletConfig = {};
let allBooks: CatalogBook[] = [];
let downloadedBooks = new Set<string>();
let activeBook: CatalogBook | null = null;
let currentGenre = 'All';
let searchQuery = '';

const readerState: ReaderState = {
  currentView: 'library',
  theme: 'sepia',
  fontSize: 18,
  layoutColumns: 'auto',
  currentPageSpread: 0,
  totalPagesSpreads: 1
};

const discoverState: DiscoverState = {
  nextUrl: null,
  previousUrl: null,
  totalCount: 0,
  currentPage: 1,
  importedIds: new Set<string>()
};

// --- DOM Cache ---
const DOM = {
  loading: document.getElementById('loading') as HTMLDivElement,
  libraryView: document.getElementById('library-view') as HTMLDivElement,
  readerView: document.getElementById('reader-view') as HTMLDivElement,
  curatorHeader: document.getElementById('curator-header-container') as HTMLDivElement,
  cachedBooksGrid: document.getElementById('cached-books-grid') as HTMLDivElement,
  cachedCountBadge: document.getElementById('cached-count-badge') as HTMLSpanElement,
  genrePills: document.getElementById('genre-pills-container') as HTMLDivElement,
  bookshelfGrid: document.getElementById('bookshelf-grid') as HTMLDivElement,
  bookCount: document.getElementById('book-count') as HTMLSpanElement,
  searchInput: document.getElementById('search-input') as HTMLInputElement,

  // Reader
  backButton: document.getElementById('back-button') as HTMLButtonElement,
  readerBookTitle: document.getElementById('reader-book-title') as HTMLHeadingElement,
  readerBookAuthor: document.getElementById('reader-book-author') as HTMLParagraphElement,
  settingsToggle: document.getElementById('settings-toggle') as HTMLButtonElement,
  settingsPanel: document.getElementById('settings-panel') as HTMLDivElement,
  shareBtn: document.getElementById('share-btn') as HTMLButtonElement,

  // Reader Navigation Arrows
  prevPageBtn: document.getElementById('prev-page-btn') as HTMLButtonElement,
  nextPageBtn: document.getElementById('next-page-btn') as HTMLButtonElement,

  // Reader Viewport
  readerViewport: document.getElementById('reader-viewport') as HTMLDivElement,
  readerContent: document.getElementById('reader-content') as HTMLElement,
  snapPoints: document.getElementById('snap-points') as HTMLDivElement,

  // Footer & Timeline
  progressTrack: document.getElementById('progress-track') as HTMLDivElement,
  progressFill: document.getElementById('progress-fill') as HTMLDivElement,
  pageIndicator: document.getElementById('page-indicator') as HTMLSpanElement,

  // QR Modal
  qrModal: document.getElementById('qr-modal') as HTMLDivElement,
  qrCanvas: document.getElementById('qr-canvas') as HTMLCanvasElement,
  qrUrlInput: document.getElementById('qr-url-input') as HTMLInputElement,
  qrClose: document.getElementById('qr-close') as HTMLButtonElement,

  // Discover Modal
  discoverBtn: document.getElementById('discover-btn') as HTMLButtonElement,
  discoverOverlay: document.getElementById('discover-overlay') as HTMLDivElement,
  discoverPanel: document.getElementById('discover-panel') as HTMLElement,
  discoverClose: document.getElementById('discover-close') as HTMLButtonElement,
  discoverSearchInput: document.getElementById('discover-search-input') as HTMLInputElement,
  discoverResults: document.getElementById('discover-results') as HTMLDivElement
};

// --- Initialization ---
async function init() {
  // Load Curator Config
  config = await loadZenoletConfig();

  // Apply curator theme defaults
  if (config.defaultTheme) {
    setTheme(config.defaultTheme, readerState);
  } else {
    const savedTheme = localStorage.getItem('zenolet-theme') as ReaderState['theme'];
    if (savedTheme) setTheme(savedTheme, readerState);
  }

  const savedFontSize = localStorage.getItem('zenolet-font-size');
  if (savedFontSize) readerState.fontSize = parseInt(savedFontSize, 10);

  // Render Curator Header
  renderCuratorHeader(DOM.curatorHeader, config.siteTitle, config.curator);

  // Fetch 1,000 Catalog
  allBooks = await fetchCatalog();

  // Append any custom Curator books from zenolet.config.json
  if (config.customBooks && config.customBooks.length > 0) {
    const customCatalog: CatalogBook[] = config.customBooks.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      subjects: [b.category || 'Curator Choice'],
      downloads: 9999,
      htmlUrl: b.htmlUrl,
      coverUrl: b.cover
    }));
    allBooks = [...customCatalog, ...allBooks];
  }

  downloadedBooks = getDownloadedBookSet();

  // Render Genre Pills
  const genres = extractPopularGenres(allBooks);
  renderGenrePills(DOM.genrePills, genres, currentGenre, (selectedGenre) => {
    currentGenre = selectedGenre;
    updateBookshelfView();
  });

  // Setup Event Listeners
  setupEventListeners();

  // Initial Bookshelf View
  updateBookshelfView();

  // Hide loading spinner
  DOM.loading.classList.add('hidden');

  // Check URL Hash for state (#s=...)
  if (window.location.hash.startsWith('#s=')) {
    await handleUrlHashState();
  }

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[Zenolet PWA] SW registration failed:', err);
    });
  }
}

function updateBookshelfView() {
  const cachedMeta = getDownloadedMetadataList();

  renderCachedBooksShelf(
    DOM.cachedBooksGrid,
    DOM.cachedCountBadge,
    cachedMeta,
    MAX_OFFLINE_BOOKS,
    (bookId) => {
      const book = allBooks.find((b) => b.id === bookId) || {
        id: bookId,
        title: `Book #${bookId}`,
        author: 'Project Gutenberg',
        subjects: ['Cached'],
        downloads: 0
      };
      openBook(book);
    },
    async (bookId) => {
      const book = allBooks.find((b) => b.id === bookId);
      if (book) {
        await toggleOfflineBook(book);
      } else {
        await removeBookOffline(bookId);
        downloadedBooks.delete(bookId);
        updateBookshelfView();
      }
    }
  );

  const filtered = filterCatalog(allBooks, searchQuery, currentGenre);
  renderBookshelf(
    filtered,
    downloadedBooks,
    DOM.bookshelfGrid,
    DOM.bookCount,
    (book) => openBook(book),
    (book) => toggleOfflineBook(book)
  );
}

// --- Book Reader Operations ---
async function openBook(book: CatalogBook, initialProgressFraction: number | null = null) {
  activeBook = book;
  DOM.loading.classList.remove('hidden');

  DOM.readerBookTitle.textContent = book.title;
  DOM.readerBookAuthor.textContent = `by ${book.author}`;

  try {
    let rawContent = '';

    // 1. Try Offline Cache API first
    const offlineData = await getStoredBookOffline(book.id);
    if (offlineData) {
      rawContent = offlineData.content;
    } else {
      // 2. Fetch via candidate static URLs (bypassing 302 redirects)
      const candidateUrls = getGutenbergCandidateUrls(book.id, book.htmlUrl);
      let lastErr: Error | null = null;

      for (const candidate of candidateUrls) {
        try {
          const proxiedUrl = buildProxyUrl(candidate, config.proxyUrl);
          const res = await fetch(proxiedUrl);
          if (res.ok) {
            const text = await res.text();
            if (text && text.length > 200) {
              rawContent = text;
              break;
            }
          }
        } catch (err) {
          lastErr = err as Error;
        }
      }

      if (!rawContent) {
        throw lastErr || new Error(`Could not load text for book #${book.id}`);
      }
    }

    // Process & Render Content
    if (rawContent.includes('<!DOCTYPE') || rawContent.includes('<html') || rawContent.includes('<p>')) {
      DOM.readerContent.innerHTML = sanitizeBookHtml(rawContent);
    } else {
      DOM.readerContent.innerHTML = await marked.parse(rawContent);
    }

    // Switch View
    DOM.libraryView.classList.add('hidden');
    DOM.readerView.classList.remove('hidden');
    readerState.currentView = 'reader';

    // Recalculate Columns & Page Spreads
    recalculatePages(
      DOM.readerViewport,
      DOM.readerContent,
      DOM.snapPoints,
      DOM.progressFill,
      DOM.pageIndicator,
      readerState,
      book.id
    );

    // Restore Progress Fraction
    const targetFraction = initialProgressFraction !== null ? initialProgressFraction : getStoredProgress(book.id);
    if (targetFraction !== null && targetFraction > 0) {
      restoreBookProgressByFraction(targetFraction, DOM.readerViewport);
    }

    // Update URL state hash quietly without page reload
    updateUrlHashState();
  } catch (err) {
    alert(`Failed to load book "${book.title}". Check your connection or CORS proxy settings.`);
    console.error('[Zenolet Reader] Load error:', err);
  } finally {
    DOM.loading.classList.add('hidden');
  }
}

function sanitizeBookHtml(rawHtml: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');

  // Strip headers, scripts, styles, boilerplate
  doc.querySelectorAll('script, style, iframe, header, footer').forEach((node) => node.remove());

  const bodyContent = doc.body ? doc.body.innerHTML : rawHtml;
  return bodyContent;
}

async function toggleOfflineBook(book: CatalogBook) {
  if (downloadedBooks.has(book.id)) {
    await removeBookOffline(book.id);
    downloadedBooks.delete(book.id);
  } else {
    DOM.loading.classList.remove('hidden');
    try {
      const candidateUrls = getGutenbergCandidateUrls(book.id, book.htmlUrl);
      let content = '';

      for (const candidate of candidateUrls) {
        try {
          const proxiedUrl = buildProxyUrl(candidate, config.proxyUrl);
          const res = await fetch(proxiedUrl);
          if (res.ok) {
            const text = await res.text();
            if (text && text.length > 200) {
              content = text;
              break;
            }
          }
        } catch (_) {}
      }

      if (!content) throw new Error('Failed to fetch offline content');

      await saveBookOffline(book, { metadata: book, content });
      downloadedBooks.add(book.id);
    } catch (err) {
      alert(`Could not download "${book.title}" for offline reading.`);
    } finally {
      DOM.loading.classList.add('hidden');
    }
  }
  updateBookshelfView();
}

// --- State & URL Encoding ---
async function updateUrlHashState() {
  if (!activeBook) return;
  const maxScroll = DOM.readerViewport.scrollWidth - DOM.readerViewport.clientWidth;
  const progress = maxScroll > 0 ? DOM.readerViewport.scrollLeft / maxScroll : 0;

  const appState: AppState = {
    bookId: activeBook.id,
    progress: parseFloat(progress.toFixed(4)),
    theme: readerState.theme,
    fontSize: readerState.fontSize
  };

  const hash = await encodeState(appState);
  window.history.replaceState(null, '', hash);
}

async function handleUrlHashState() {
  const hash = window.location.hash;
  const state = await decodeState(hash);
  if (!state || !state.bookId) return;

  if (state.theme) setTheme(state.theme as ReaderState['theme'], readerState);
  if (state.fontSize) setFontSize(state.fontSize, readerState, () => {});

  const book = allBooks.find((b) => b.id === state.bookId) || {
    id: state.bookId,
    title: `Gutenberg Book #${state.bookId}`,
    author: 'Project Gutenberg',
    subjects: ['Literature'],
    downloads: 0
  };

  await openBook(book, state.progress);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Search Bar
  DOM.searchInput.addEventListener('input', (e) => {
    searchQuery = (e.target as HTMLInputElement).value;
    updateBookshelfView();
  });

  // Back Button to Bookshelf
  DOM.backButton.addEventListener('click', () => {
    DOM.readerView.classList.add('hidden');
    DOM.libraryView.classList.remove('hidden');
    readerState.currentView = 'library';
    activeBook = null;
    window.history.replaceState(null, '', window.location.pathname);
    updateBookshelfView();
  });

  // Settings Panel Toggle
  setupSettingsModal(DOM.settingsPanel, DOM.settingsToggle, readerState, () => {
    if (activeBook) {
      recalculatePages(
        DOM.readerViewport,
        DOM.readerContent,
        DOM.snapPoints,
        DOM.progressFill,
        DOM.pageIndicator,
        readerState,
        activeBook.id
      );
    }
  });

  // QR Code Share Handoff
  DOM.shareBtn.addEventListener('click', async () => {
    await updateUrlHashState();
    const fullUrl = window.location.href;
    await openQRModal(DOM.qrModal, DOM.qrCanvas, DOM.qrUrlInput, fullUrl);
  });

  DOM.qrClose.addEventListener('click', () => closeQRModal(DOM.qrModal));
  DOM.qrModal.addEventListener('click', (e) => {
    if (e.target === DOM.qrModal) closeQRModal(DOM.qrModal);
  });

  // Discover Gutenberg Modal
  DOM.discoverBtn.addEventListener('click', () => {
    openDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);
  });
  DOM.discoverClose.addEventListener('click', () => {
    closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);
  });
  DOM.discoverOverlay.addEventListener('click', () => {
    closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);
  });

  let discoverTimeout: ReturnType<typeof setTimeout> | null = null;
  DOM.discoverSearchInput.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value.trim();
    if (discoverTimeout) clearTimeout(discoverTimeout);
    if (query.length > 2) {
      discoverTimeout = setTimeout(() => {
        searchGutenberg(query, DOM.discoverResults, discoverState, (id, title, author, htmlUrl) => {
          closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);
          openBook({ id, title, author, subjects: ['Imported'], downloads: 0, htmlUrl });
        });
      }, 400);
    }
  });

  // Navigation Arrow Button Clicks
  DOM.prevPageBtn.addEventListener('click', () => {
    DOM.readerViewport.scrollBy({ left: -DOM.readerViewport.clientWidth, behavior: 'smooth' });
  });
  DOM.nextPageBtn.addEventListener('click', () => {
    DOM.readerViewport.scrollBy({ left: DOM.readerViewport.clientWidth, behavior: 'smooth' });
  });

  // Keyboard Shortcuts (Arrow Left/Right, Space)
  document.addEventListener('keydown', (e) => {
    if (readerState.currentView !== 'reader') return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      DOM.readerViewport.scrollBy({ left: -DOM.readerViewport.clientWidth, behavior: 'smooth' });
    } else if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      DOM.readerViewport.scrollBy({ left: DOM.readerViewport.clientWidth, behavior: 'smooth' });
    }
  });

  // Viewport Drag to Scroll
  setupDragToScroll(DOM.readerViewport);

  // Viewport Scroll Listener for Progress Indicator & URL State
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  DOM.readerViewport.addEventListener('scroll', () => {
    if (!activeBook) return;
    updatePaginationIndicator(
      DOM.readerViewport,
      DOM.readerContent,
      DOM.progressFill,
      DOM.pageIndicator,
      readerState,
      activeBook.id
    );

    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => updateUrlHashState(), 400);
  });

  // Resize Listener
  window.addEventListener('resize', () => {
    if (activeBook && readerState.currentView === 'reader') {
      recalculatePages(
        DOM.readerViewport,
        DOM.readerContent,
        DOM.snapPoints,
        DOM.progressFill,
        DOM.pageIndicator,
        readerState,
        activeBook.id
      );
    }
  });

  // Window Hash Change
  window.addEventListener('hashchange', () => handleUrlHashState());
}

// Start app
document.addEventListener('DOMContentLoaded', () => init());
