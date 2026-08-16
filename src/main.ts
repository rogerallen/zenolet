import './style.css';
import { marked } from 'marked';
import { loadZenoletConfig, type ZenoletConfig } from './services/config.ts';
import { fetchCatalog, type CatalogBook } from './services/catalog.ts';
import { getGutenbergCandidateUrls, fetchWithProxyFallback, processBookHtml } from './services/corsProxy.ts';
import { encodeState, decodeState, type AppState } from './services/state.ts';
import {
  saveBookOffline,
  getStoredBookOffline,
  getStoredSlots,
  removeBookFromSlot,
  getStoredProgress,
  restoreBookProgressByFraction,
  type BookMetadata
} from './services/storage.ts';
import { renderCuratorHeader, render8SlotGrid } from './components/Bookshelf.ts';
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
let activeBook: CatalogBook | null = null;
let activeSlotIndex: number | null = null;

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
  libraryView: document.getElementById('library-view') as HTMLDivElement,
  readerView: document.getElementById('reader-view') as HTMLDivElement,
  curatorHeader: document.getElementById('curator-header-container') as HTMLDivElement,
  slotsGrid: document.getElementById('slots-grid') as HTMLDivElement,

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

  // Search GUI / Discover Modal
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

  // Render Minimal Curator Header
  renderCuratorHeader(DOM.curatorHeader, config.siteTitle, config.curator);

  // Render 8-Slot Bookshelf View immediately from local storage (synchronous 0ms render)
  update8SlotShelfView();

  // Setup Event Listeners
  setupEventListeners();

  // Fetch Catalog for search GUI
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

  // Check URL Hash for state (#s=...)
  if (window.location.hash.startsWith('#s=')) {
    await handleUrlHashState();
  }

  // Register PWA Service Worker (Production only)
  if ('serviceWorker' in navigator) {
    if (import.meta.env.DEV) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      });
    } else {
      const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
      navigator.serviceWorker.register(`${base}sw.js`).catch((err) => {
        console.warn('[Zenolet PWA] SW registration failed:', err);
      });
    }
  }
}

function update8SlotShelfView() {
  const slots = getStoredSlots();

  render8SlotGrid(
    DOM.slotsGrid,
    slots,
    8,
    (bookId, slotIndex) => {
      activeSlotIndex = slotIndex;
      const book = allBooks.find((b) => b.id === bookId) || {
        id: bookId,
        title: slots[slotIndex]?.title || `Book #${bookId}`,
        author: slots[slotIndex]?.author || 'Project Gutenberg',
        subjects: ['Classics'],
        downloads: 0
      };
      openBook(book, null, true, slotIndex);
    },
    async (_bookId, slotIndex) => {
      await removeBookFromSlot(slotIndex);
      update8SlotShelfView();
    },
    (slotIndex) => {
      activeSlotIndex = slotIndex;
      openSearchGUI();
    }
  );
}

// --- Search GUI Operations ---
function openSearchGUI() {
  openDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);
  DOM.discoverSearchInput.value = '';
  searchGutenberg('', DOM.discoverResults, allBooks, discoverState, handleSelectBookForSlot);
}

async function handleSelectBookForSlot(bookId: string, title: string, author: string, htmlUrl?: string) {
  closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);

  const book: CatalogBook = allBooks.find((b) => b.id === bookId) || {
    id: bookId,
    title,
    author,
    subjects: ['Selected Title'],
    downloads: 0,
    htmlUrl
  };

  await openBook(book, null, true, activeSlotIndex);
}

// --- Book Reader Operations ---
async function openBook(
  book: CatalogBook,
  initialProgressFraction: number | null = null,
  pushHistory: boolean = true,
  targetSlotIndex?: number | null
) {
  activeBook = book;
  if (typeof targetSlotIndex === 'number') {
    activeSlotIndex = targetSlotIndex;
  }

  DOM.readerBookTitle.textContent = book.title;
  DOM.readerBookAuthor.textContent = `by ${book.author}`;

  try {
    let rawContent = '';
    let bookSourceUrl = `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}-images.html`;

    // 1. Try Offline Cache API first
    const offlineData = await getStoredBookOffline(book.id);
    if (offlineData) {
      rawContent = offlineData.content;
    } else {
      // 2. Fetch via candidate static URLs & proxy fallbacks
      const candidateUrls = getGutenbergCandidateUrls(book.id, book.htmlUrl);
      let lastErr: Error | null = null;

      for (const candidate of candidateUrls) {
        try {
          const text = await fetchWithProxyFallback(candidate, config.proxyUrl);
          if (text && text.length > 200) {
            rawContent = text;
            bookSourceUrl = candidate;
            break;
          }
        } catch (err) {
          lastErr = err as Error;
        }
      }

      if (!rawContent) {
        throw lastErr || new Error(`Could not load text for book #${book.id}`);
      }

      // Always auto-save book offline into slot storage upon selection
      const processedContent = processBookHtml(rawContent, bookSourceUrl, config.proxyUrl);
      const meta: BookMetadata = { id: book.id, title: book.title, author: book.author, htmlUrl: book.htmlUrl };
      const slotToSave = typeof targetSlotIndex === 'number' ? targetSlotIndex : activeSlotIndex;
      await saveBookOffline(meta, { metadata: meta, content: processedContent }, slotToSave);
    }

    // Process & Render Content
    if (rawContent.includes('<!DOCTYPE') || rawContent.includes('<html') || rawContent.includes('<p>')) {
      DOM.readerContent.innerHTML = processBookHtml(rawContent, bookSourceUrl, config.proxyUrl);
    } else {
      DOM.readerContent.innerHTML = await marked.parse(rawContent);
    }

    // Switch View
    DOM.libraryView.classList.add('hidden');
    DOM.readerView.classList.remove('hidden');
    readerState.currentView = 'reader';

    // Update bookshelf 8-slot view
    update8SlotShelfView();

    // Ensure DOM viewport scroll is clean before opening new book
    DOM.readerViewport.scrollLeft = 0;

    // Recalculate Columns & Page Spreads without preserving stale DOM scroll
    recalculatePages(
      DOM.readerViewport,
      DOM.readerContent,
      DOM.snapPoints,
      DOM.progressFill,
      DOM.pageIndicator,
      readerState,
      book.id,
      false
    );

    // Restore Progress Fraction from storage if available
    const targetFraction = initialProgressFraction !== null ? initialProgressFraction : getStoredProgress(book.id);
    if (targetFraction !== null && targetFraction > 0) {
      restoreBookProgressByFraction(targetFraction, DOM.readerViewport);
      updatePaginationIndicator(
        DOM.readerViewport,
        DOM.readerContent,
        DOM.progressFill,
        DOM.pageIndicator,
        readerState,
        book.id
      );
    }

    // Update URL state hash (push new entry if opening book, replace if restored)
    await updateUrlHashState(pushHistory);
  } catch (err) {
    alert(`Failed to load book "${book.title}". Check your connection or CORS proxy settings.`);
    console.error('[Zenolet Reader] Load error:', err);
  }
}

function closeReaderAndReturnToLibrary() {
  DOM.readerView.classList.add('hidden');
  DOM.libraryView.classList.remove('hidden');
  readerState.currentView = 'library';
  activeBook = null;
  DOM.readerViewport.scrollLeft = 0;
  if (window.location.hash) {
    window.history.replaceState({ view: 'library' }, '', window.location.pathname);
  }
  update8SlotShelfView();
}

// --- State & URL Encoding ---
async function updateUrlHashState(pushHistory: boolean = false) {
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
  if (pushHistory) {
    window.history.pushState({ view: 'reader', bookId: activeBook.id }, '', hash);
  } else {
    window.history.replaceState({ view: 'reader', bookId: activeBook.id }, '', hash);
  }
}

async function handleUrlHashState() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#s=')) {
    if (readerState.currentView === 'reader') {
      closeReaderAndReturnToLibrary();
    }
    return;
  }

  const state = await decodeState(hash);
  if (!state || !state.bookId) {
    if (readerState.currentView === 'reader') {
      closeReaderAndReturnToLibrary();
    }
    return;
  }

  if (state.theme) setTheme(state.theme as ReaderState['theme'], readerState);
  if (state.fontSize) setFontSize(state.fontSize, readerState, () => {});

  const book = allBooks.find((b) => b.id === state.bookId) || {
    id: state.bookId,
    title: `Gutenberg Book #${state.bookId}`,
    author: 'Project Gutenberg',
    subjects: ['Literature'],
    downloads: 0
  };

  await openBook(book, state.progress, false);
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Back Button to Main Page
  DOM.backButton.addEventListener('click', (e) => {
    e.preventDefault();
    closeReaderAndReturnToLibrary();
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

  // Search GUI Modal Listeners
  DOM.discoverClose.addEventListener('click', () => {
    closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);
  });
  DOM.discoverOverlay.addEventListener('click', () => {
    closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);
  });

  let discoverTimeout: ReturnType<typeof setTimeout> | null = null;
  DOM.discoverSearchInput.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value;
    if (discoverTimeout) clearTimeout(discoverTimeout);
    discoverTimeout = setTimeout(() => {
      searchGutenberg(query, DOM.discoverResults, allBooks, discoverState, handleSelectBookForSlot);
    }, 250);
  });

  // Navigation Arrow Button Clicks
  DOM.prevPageBtn.addEventListener('click', () => {
    DOM.readerViewport.scrollBy({ left: -DOM.readerViewport.clientWidth, behavior: 'auto' });
  });
  DOM.nextPageBtn.addEventListener('click', () => {
    DOM.readerViewport.scrollBy({ left: DOM.readerViewport.clientWidth, behavior: 'auto' });
  });

  // Keyboard Shortcuts (Arrow Left/Right, Space)
  document.addEventListener('keydown', (e) => {
    if (readerState.currentView !== 'reader') return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      DOM.readerViewport.scrollBy({ left: -DOM.readerViewport.clientWidth, behavior: 'auto' });
    } else if (e.key === 'ArrowRight' || e.key === ' ') {
      e.preventDefault();
      DOM.readerViewport.scrollBy({ left: DOM.readerViewport.clientWidth, behavior: 'auto' });
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

  // Window Navigation Listeners (Back/Forward buttons)
  window.addEventListener('hashchange', () => handleUrlHashState());
  window.addEventListener('popstate', () => handleUrlHashState());
}

// Start app
document.addEventListener('DOMContentLoaded', () => init());
