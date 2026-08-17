import './style.css';
import { marked } from 'marked';
import { loadZenoletConfig, type ZenoletConfig } from './services/config.ts';
import { fetchCatalog, type CatalogBook } from './services/catalog.ts';
import {
  getGutenbergCandidateUrls,
  fetchWithProxyFallback,
  fetchArrayBufferWithProxy,
  processBookHtml,
  cacheBookImagesOffline
} from './services/corsProxy.ts';
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
  recalculatePages,
  updatePaginationIndicator,
  setupDragToScroll,
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
  currentPageSpread: 0,
  totalPagesSpreads: 1
};

// --- DOM Cache ---
const DOM = {
  libraryView: document.getElementById('library-view') as HTMLDivElement,
  librarySettingsToggle: document.getElementById('library-settings-toggle') as HTMLButtonElement | null,
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
  footerRepoLink: document.getElementById('footer-repo-link') as HTMLAnchorElement | null,

  // QR Modal
  qrModal: document.getElementById('qr-modal') as HTMLDivElement,
  qrCanvas: document.getElementById('qr-canvas') as HTMLCanvasElement,
  qrUrlInput: document.getElementById('qr-url-input') as HTMLInputElement,
  qrClose: document.getElementById('qr-close') as HTMLButtonElement,

  // About Modal
  aboutToggle: document.getElementById('about-toggle') as HTMLButtonElement | null,
  aboutModal: document.getElementById('about-modal') as HTMLDivElement | null,
  aboutClose: document.getElementById('about-close') as HTMLButtonElement | null,

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

  // Apply Repo URL to Footer
  if (config.repoUrl && DOM.footerRepoLink) {
    DOM.footerRepoLink.href = config.repoUrl;
  }

  // Apply curator settings & theme defaults
  const themeDefault = config.settings?.defaultTheme || (config as any).defaultTheme;
  if (themeDefault) {
    setTheme(themeDefault, readerState);
  } else {
    const savedTheme = localStorage.getItem('zenolet-theme') as ReaderState['theme'];
    if (savedTheme) setTheme(savedTheme, readerState);
  }

  const configuredFontSize = config.settings?.fontSize || (config as any).fontSize;
  const savedFontSize = localStorage.getItem('zenolet-font-size');
  if (savedFontSize) {
    readerState.fontSize = parseInt(savedFontSize, 10);
  } else if (configuredFontSize) {
    readerState.fontSize = configuredFontSize;
  }

  const configuredColumns = config.settings?.layoutColumns || (config as any).layoutColumns;
  const savedColumns = localStorage.getItem('zenolet-columns') as ReaderState['layoutColumns'];
  if (savedColumns) {
    readerState.layoutColumns = savedColumns;
  } else if (configuredColumns) {
    readerState.layoutColumns = configuredColumns;
  }

  // Render Minimal Curator Header
  const siteTitle = config.title || config.siteTitle;
  renderCuratorHeader(DOM.curatorHeader, siteTitle, config.curator, config.blurb);

  // Render 8-Slot Bookshelf View immediately from local storage (synchronous 0ms render)
  update8SlotShelfView();

  // Setup Event Listeners
  setupEventListeners();

  // Fetch Catalog for search GUI
  allBooks = await fetchCatalog();

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
  renderLocalCatalogResults('', allBooks, DOM.discoverResults, handleSelectBookForSlot);
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
      DOM.readerContent.innerHTML = rawContent;

      // In background, upgrade any uncached images to offline base64 data URLs
      if (rawContent.includes('<img') && !rawContent.includes('data:image')) {
        const meta: BookMetadata = {
          id: book.id,
          title: book.title,
          author: book.author,
          epubUrl: book.epubUrl,
          htmlUrl: book.htmlUrl
        };
        const slotToSave = typeof targetSlotIndex === 'number' ? targetSlotIndex : activeSlotIndex;
        cacheBookImagesOffline(rawContent, config.proxyUrl).then((fullyCachedHtml) => {
          if (fullyCachedHtml && fullyCachedHtml !== rawContent) {
            saveBookOffline(meta, { metadata: meta, content: fullyCachedHtml }, slotToSave);
          }
        });
      }
    } else {
      // 2. Fetch via candidate static URLs (EPUB3 primary, HTML fallback)
      const candidateUrls = getGutenbergCandidateUrls(book.id, book.epubUrl || book.htmlUrl);
      let lastErr: Error | null = null;
      let isEpub = false;
      let epubBuffer: ArrayBuffer | null = null;

      for (const candidate of candidateUrls) {
        try {
          if (candidate.includes('.epub') || candidate.endsWith('.images')) {
            const buffer = await fetchArrayBufferWithProxy(candidate, config.proxyUrl);
            if (buffer && buffer.byteLength > 100) {
              epubBuffer = buffer;
              isEpub = true;
              bookSourceUrl = candidate;
              break;
            }
          } else {
            const text = await fetchWithProxyFallback(candidate, config.proxyUrl);
            if (text && text.length > 200) {
              rawContent = text;
              bookSourceUrl = candidate;
              break;
            }
          }
        } catch (err) {
          lastErr = err as Error;
        }
      }

      let processedContent = '';

      if (isEpub && epubBuffer) {
        // Parse & Stitch EPUB3 Archive
        const parsed = parseEpubArchive(epubBuffer);
        processedContent = parsed.htmlContent;
      } else if (rawContent) {
        // Process Legacy HTML
        processedContent =
          rawContent.includes('<!DOCTYPE') || rawContent.includes('<html') || rawContent.includes('<p>')
            ? processBookHtml(rawContent, bookSourceUrl, config.proxyUrl)
            : await marked.parse(rawContent);
      } else {
        throw lastErr || new Error(`Could not load book #${book.id}`);
      }

      DOM.readerContent.innerHTML = processedContent;

      // Always auto-save book offline into slot storage upon selection
      const meta: BookMetadata = {
        id: book.id,
        title: book.title,
        author: book.author,
        epubUrl: book.epubUrl,
        htmlUrl: book.htmlUrl
      };
      const slotToSave = typeof targetSlotIndex === 'number' ? targetSlotIndex : activeSlotIndex;
      await saveBookOffline(meta, { metadata: meta, content: processedContent }, slotToSave);

      // In background, ensure all images are cached as data URLs
      if (processedContent.includes('<img') && !processedContent.includes('data:image')) {
        cacheBookImagesOffline(processedContent, config.proxyUrl).then((fullyCachedHtml) => {
          if (fullyCachedHtml && fullyCachedHtml !== processedContent) {
            saveBookOffline(meta, { metadata: meta, content: fullyCachedHtml }, slotToSave);
          }
        });
      }
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

  // Settings Panel Toggle (Available in both Bookshelf and Reader views)
  setupSettingsModal(DOM.settingsPanel, [DOM.settingsToggle, DOM.librarySettingsToggle], readerState, () => {
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

// Start app
document.addEventListener('DOMContentLoaded', () => init());
