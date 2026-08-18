import './style.css';
import { loadZenoletConfig, type ZenoletConfig } from './services/config.ts';
import { fetchCatalog, type CatalogBook } from './services/catalog.ts';
import { getGutenbergCandidateUrls, fetchArrayBufferWithProxy } from './services/corsProxy.ts';
import { parseEpubArchive } from './services/epub.ts';
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
  setupDragToScroll,
  recalculatePages,
  updatePaginationIndicator,
  type ReaderState
} from './components/ReaderEngine.ts';
import { setupSettingsModal } from './components/SettingsModal.ts';
import { openQRModal, closeQRModal } from './components/QRModal.ts';
import { openDiscoverPanel, closeDiscoverPanel, renderLocalCatalogResults } from './components/DiscoverModal.ts';

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
  currentPageSpread: 1,
  totalPagesSpreads: 1
};

// --- DOM Element Cache ---
let DOM: {
  curatorHeaderContainer: HTMLElement;
  slotsGrid: HTMLDivElement;
  libraryView: HTMLDivElement;
  readerView: HTMLDivElement;
  readerViewport: HTMLDivElement;
  readerContent: HTMLElement;
  snapPoints: HTMLDivElement;
  readerBookTitle: HTMLHeadingElement;
  readerBookAuthor: HTMLParagraphElement;
  btnBack: HTMLButtonElement;
  btnSettings: HTMLButtonElement;
  btnLibrarySettings: HTMLButtonElement;
  btnQR: HTMLButtonElement;
  prevPageBtn: HTMLButtonElement;
  nextPageBtn: HTMLButtonElement;
  progressFill: HTMLDivElement;
  progressTrack: HTMLDivElement;
  pageIndicator: HTMLSpanElement;
  settingsPanel: HTMLDivElement;
  aboutModal: HTMLDivElement;
  aboutToggle: HTMLButtonElement;
  aboutClose: HTMLButtonElement;
  qrModal: HTMLDivElement;
  qrClose: HTMLButtonElement;
  qrCanvas: HTMLCanvasElement;
  qrUrlInput: HTMLInputElement;
  discoverOverlay: HTMLDivElement;
  discoverPanel: HTMLElement;
  discoverClose: HTMLButtonElement;
  discoverSearchInput: HTMLInputElement;
  discoverResults: HTMLDivElement;
};

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  await initApp();
});

async function initApp() {
  // Cache DOM Elements
  DOM = {
    curatorHeaderContainer: document.getElementById('curator-header-container') as HTMLElement,
    slotsGrid: document.getElementById('slots-grid') as HTMLDivElement,
    libraryView: document.getElementById('library-view') as HTMLDivElement,
    readerView: document.getElementById('reader-view') as HTMLDivElement,
    readerViewport: document.getElementById('reader-viewport') as HTMLDivElement,
    readerContent: document.getElementById('reader-content') as HTMLElement,
    snapPoints: document.getElementById('snap-points') as HTMLDivElement,
    readerBookTitle: document.getElementById('reader-book-title') as HTMLHeadingElement,
    readerBookAuthor: document.getElementById('reader-book-author') as HTMLParagraphElement,
    btnBack: document.getElementById('back-button') as HTMLButtonElement,
    btnSettings: document.getElementById('settings-toggle') as HTMLButtonElement,
    btnLibrarySettings: document.getElementById('library-settings-toggle') as HTMLButtonElement,
    btnQR: document.getElementById('share-btn') as HTMLButtonElement,
    prevPageBtn: document.getElementById('prev-page-btn') as HTMLButtonElement,
    nextPageBtn: document.getElementById('next-page-btn') as HTMLButtonElement,
    progressFill: document.getElementById('progress-fill') as HTMLDivElement,
    progressTrack: document.getElementById('progress-track') as HTMLDivElement,
    pageIndicator: document.getElementById('page-indicator') as HTMLSpanElement,
    settingsPanel: document.getElementById('settings-panel') as HTMLDivElement,
    aboutModal: document.getElementById('about-modal') as HTMLDivElement,
    aboutToggle: document.getElementById('about-toggle') as HTMLButtonElement,
    aboutClose: document.getElementById('about-close') as HTMLButtonElement,
    qrModal: document.getElementById('qr-modal') as HTMLDivElement,
    qrClose: document.getElementById('qr-close') as HTMLButtonElement,
    qrCanvas: document.getElementById('qr-canvas') as HTMLCanvasElement,
    qrUrlInput: document.getElementById('qr-url-input') as HTMLInputElement,
    discoverOverlay: document.getElementById('discover-overlay') as HTMLDivElement,
    discoverPanel: document.getElementById('discover-panel') as HTMLElement,
    discoverClose: document.getElementById('discover-close') as HTMLButtonElement,
    discoverSearchInput: document.getElementById('discover-search-input') as HTMLInputElement,
    discoverResults: document.getElementById('discover-results') as HTMLDivElement
  };

  // Load Curator Configuration (zenolet.config.json)
  config = await loadZenoletConfig();

  // Render Curator Header from Config
  renderCuratorHeader(DOM.curatorHeaderContainer, config.title, config.curator, config.blurb);

  // Initialize Settings
  setupSettingsModal(DOM.settingsPanel, [DOM.btnSettings, DOM.btnLibrarySettings], readerState, () => {
    if (activeBook) {
      recalculatePages(
        DOM.readerViewport,
        DOM.readerContent,
        DOM.snapPoints,
        DOM.progressFill,
        DOM.pageIndicator,
        readerState,
        activeBook.id,
        true
      );
    }
  });

  // Apply Initial Theme
  const initialTheme = (localStorage.getItem('zenolet-theme') as ReaderState['theme']) || 'sepia';
  setTheme(initialTheme, readerState);

  // Initial Bookshelf Render (8 discrete slots)
  update8SlotShelfView();

  // Setup Event Listeners
  setupEventListeners();

  // Fetch Catalog for search GUI
  allBooks = await fetchCatalog();

  // Check URL Hash for state (#s=...)
  if (window.location.hash.startsWith('#s=')) {
    await handleUrlHashState();
  }

  // Register PWA Service Worker
  if ('serviceWorker' in navigator && !import.meta.env.DEV) {
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
    navigator.serviceWorker.register(`${base}sw.js`).catch((err) => {
      console.warn('[Zenolet PWA] SW registration failed:', err);
    });
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
  renderLocalCatalogResults('', allBooks, DOM.discoverResults, handleSelectBookForSlot);
}

async function handleSelectBookForSlot(bookId: string, title: string, author: string, epubUrl?: string) {
  closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);

  const book: CatalogBook = allBooks.find((b) => b.id === bookId) || {
    id: bookId,
    title,
    author,
    subjects: ['Selected Title'],
    downloads: 0,
    epubUrl
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
    let processedContent = '';

    // 1. Try Offline Cache API first
    const offlineData = await getStoredBookOffline(book.id);
    if (offlineData) {
      processedContent = offlineData.content;
      DOM.readerContent.innerHTML = processedContent;
    } else {
      // 2. Fetch via candidate EPUB URLs
      const candidateUrls = getGutenbergCandidateUrls(book.id, book.epubUrl);
      let lastErr: Error | null = null;
      let epubBuffer: ArrayBuffer | null = null;

      for (const candidate of candidateUrls) {
        try {
          const buffer = await fetchArrayBufferWithProxy(candidate, config.proxyUrl);
          if (buffer && buffer.byteLength > 100) {
            epubBuffer = buffer;
            break;
          }
        } catch (err) {
          lastErr = err as Error;
        }
      }

      if (!epubBuffer) {
        throw lastErr || new Error(`Could not load EPUB for book #${book.id}`);
      }

      // Parse & Stitch EPUB3 Archive
      const parsed = parseEpubArchive(epubBuffer);
      processedContent = parsed.htmlContent;
      DOM.readerContent.innerHTML = processedContent;

      // Always auto-save book offline into slot storage upon selection
      const meta: BookMetadata = {
        id: book.id,
        title: book.title,
        author: book.author,
        epubUrl: book.epubUrl
      };
      const slotToSave = typeof targetSlotIndex === 'number' ? targetSlotIndex : activeSlotIndex;
      await saveBookOffline(meta, { metadata: meta, content: processedContent }, slotToSave);
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
  DOM.btnBack.addEventListener('click', (e) => {
    e.preventDefault();
    closeReaderAndReturnToLibrary();
  });

  // QR Code Share Handoff
  DOM.btnQR.addEventListener('click', async () => {
    await updateUrlHashState();
    const fullUrl = window.location.href;
    await openQRModal(DOM.qrModal, DOM.qrCanvas, DOM.qrUrlInput, fullUrl);
  });

  DOM.qrClose.addEventListener('click', () => closeQRModal(DOM.qrModal));
  DOM.qrModal.addEventListener('click', (e) => {
    if (e.target === DOM.qrModal) closeQRModal(DOM.qrModal);
  });

  // About Modal Listeners
  DOM.aboutToggle?.addEventListener('click', () => {
    DOM.aboutModal?.classList.add('visible');
  });
  DOM.aboutClose?.addEventListener('click', () => {
    DOM.aboutModal?.classList.remove('visible');
  });
  DOM.aboutModal?.addEventListener('click', (e) => {
    if (e.target === DOM.aboutModal) DOM.aboutModal?.classList.remove('visible');
  });

  // Search GUI Modal Listeners
  DOM.discoverClose.addEventListener('click', () => {
    closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);
  });
  DOM.discoverOverlay.addEventListener('click', () => {
    closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);
  });

  DOM.discoverSearchInput.addEventListener('input', (e) => {
    const query = (e.target as HTMLInputElement).value;
    renderLocalCatalogResults(query, allBooks, DOM.discoverResults, handleSelectBookForSlot);
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
    if (e.key === 'Escape') {
      DOM.aboutModal?.classList.remove('visible');
      closeQRModal(DOM.qrModal);
      closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);
      DOM.settingsPanel.classList.remove('visible');
    }

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
