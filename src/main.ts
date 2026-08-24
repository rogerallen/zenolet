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
  saveSlots,
  removeBookFromSlot,
  getStoredProgress,
  getStoredProgressFraction,
  restoreBookProgressByFraction,
  flushBookProgress,
  getActualStorageUsage,
  formatStorageSummary,
  type BookMetadata
} from './services/storage.ts';
import {
  renderCuratorHeader,
  renderAboutLibrarySection,
  render8SlotGrid,
  type LoadingSlotState
} from './components/Bookshelf.ts';
import {
  setTheme,
  setFontSize,
  setLayoutColumns,
  recalculatePages,
  updatePaginationIndicator,
  type ReaderState
} from './components/ReaderEngine.ts';
import { setupSettingsModal } from './components/SettingsModal.ts';
import { openQRModal, closeQRModal } from './components/QRModal.ts';
import { openDiscoverPanel, closeDiscoverPanel, renderLocalCatalogResults } from './components/DiscoverModal.ts';
import {
  closeChapterPopup,
  invalidateChapterMarkers,
  getElementSpreadIndex,
  resolveChapterElement
} from './components/Timeline.ts';

import type { EpubChapter } from './services/epub.ts';

// --- State ---
let config: ZenoletConfig = {};
let allBooks: CatalogBook[] = [];
let activeBook: CatalogBook | null = null;
let activeBookChapters: EpubChapter[] = [];
let activeSlotIndex: number | null = null;
let loadingSlotState: LoadingSlotState | null = null;

const readerState: ReaderState = {
  currentView: 'library',
  theme: 'sepia',
  fontSize: 16,
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
  aboutLibraryContainer: HTMLElement;
  aboutToggle: HTMLButtonElement;
  aboutClose: HTMLButtonElement;
  footerRepoLink: HTMLAnchorElement;
  qrModal: HTMLDivElement;
  qrClose: HTMLButtonElement;
  qrCanvas: HTMLCanvasElement;
  qrUrlInput: HTMLInputElement;
  discoverOverlay: HTMLDivElement;
  discoverPanel: HTMLElement;
  discoverClose: HTMLButtonElement;
  discoverSearchInput: HTMLInputElement;
  discoverResults: HTMLDivElement;
  libraryStorageStatus: HTMLSpanElement;
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
    aboutLibraryContainer: document.getElementById('about-library-container') as HTMLElement,
    aboutToggle: document.getElementById('about-toggle') as HTMLButtonElement,
    aboutClose: document.getElementById('about-close') as HTMLButtonElement,
    footerRepoLink: document.getElementById('footer-repo-link') as HTMLAnchorElement,
    qrModal: document.getElementById('qr-modal') as HTMLDivElement,
    qrClose: document.getElementById('qr-close') as HTMLButtonElement,
    qrCanvas: document.getElementById('qr-canvas') as HTMLCanvasElement,
    qrUrlInput: document.getElementById('qr-url-input') as HTMLInputElement,
    discoverOverlay: document.getElementById('discover-overlay') as HTMLDivElement,
    discoverPanel: document.getElementById('discover-panel') as HTMLElement,
    discoverClose: document.getElementById('discover-close') as HTMLButtonElement,
    discoverSearchInput: document.getElementById('discover-search-input') as HTMLInputElement,
    discoverResults: document.getElementById('discover-results') as HTMLDivElement,
    libraryStorageStatus: document.getElementById('library-storage-status') as HTMLSpanElement
  };

  // Load Curator Configuration (curator/config.json)
  config = await loadZenoletConfig();

  // Dynamically set Document Title from Config
  if (config.title) {
    document.title = `${config.title} — Zenolet`;
  }

  // Dynamically set Footer GitHub Repository Link
  if (config.repoUrl && DOM.footerRepoLink) {
    DOM.footerRepoLink.href = config.repoUrl;
  }

  // Render Curator Header from Config
  renderCuratorHeader(DOM.curatorHeaderContainer, config.title, config.curator, config.blurb);

  // Render Curated Library Section in About Modal
  if (DOM.aboutLibraryContainer) {
    renderAboutLibrarySection(DOM.aboutLibraryContainer, config.title, config.curator, config.blurb);
  }

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
        true,
        false,
        activeBookChapters
      );
    }
  });

  // Apply Initial Theme, Font Size & Column Settings
  const initialTheme =
    (localStorage.getItem('zenolet-theme') as ReaderState['theme']) || config.settings?.defaultTheme || 'sepia';
  setTheme(initialTheme, readerState);

  const savedFontSize = parseInt(localStorage.getItem('zenolet-font-size') || '', 10);
  const initialFontSize =
    savedFontSize >= 12 && savedFontSize <= 32
      ? savedFontSize
      : config.settings?.fontSize && config.settings.fontSize >= 12 && config.settings.fontSize <= 32
        ? config.settings.fontSize
        : 16;
  setFontSize(initialFontSize, readerState, () => {});

  const savedColumns = localStorage.getItem('zenolet-layout-columns') as ReaderState['layoutColumns'];
  const initialColumns =
    savedColumns && ['auto', '1', '2', '3'].includes(savedColumns)
      ? savedColumns
      : config.settings?.layoutColumns || 'auto';
  setLayoutColumns(initialColumns, readerState, () => {});

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
        coverUrl: slots[slotIndex]?.coverUrl,
        epubUrl: slots[slotIndex]?.epubUrl,
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
    },
    loadingSlotState
  );

  // Update actual storage usage summary in footer
  getActualStorageUsage().then(({ bookCount, totalBytes }) => {
    if (DOM?.libraryStorageStatus) {
      DOM.libraryStorageStatus.textContent = formatStorageSummary(bookCount, totalBytes);
    }
  });
}

// --- Search GUI Operations ---
function openSearchGUI() {
  openDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel, DOM.discoverSearchInput);
  DOM.discoverSearchInput.value = '';
  renderLocalCatalogResults('', allBooks, DOM.discoverResults, handleSelectBookForSlot);
}

async function handleSelectBookForSlot(
  bookId: string,
  title: string,
  author: string,
  epubUrl?: string,
  coverUrl?: string
) {
  closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);

  const book: CatalogBook = allBooks.find((b) => b.id === bookId) || {
    id: bookId,
    title,
    author,
    subjects: ['Selected Title'],
    downloads: 0,
    epubUrl,
    coverUrl
  };

  const targetSlot = typeof activeSlotIndex === 'number' ? activeSlotIndex : 0;
  await loadBookIntoSlot(book, targetSlot);
}

// --- Slot Download Operations (Stay on Shelf) ---
async function loadBookIntoSlot(book: CatalogBook, targetSlotIndex: number): Promise<void> {
  // Set slot spinner loading state while downloading
  loadingSlotState = {
    slotIndex: targetSlotIndex,
    book: {
      id: book.id,
      title: book.title,
      author: book.author,
      epubUrl: book.epubUrl,
      coverUrl: book.coverUrl
    }
  };
  update8SlotShelfView();

  try {
    // 1. Check if already stored offline in Cache API
    const offlineData = await getStoredBookOffline(book.id);
    let processedContent = '';
    let chapters: EpubChapter[] = [];

    if (offlineData) {
      processedContent = offlineData.content;
      chapters = offlineData.chapters || [];
    } else {
      // 2. Fetch binary EPUB via candidate URLs
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
      chapters = parsed.chapters || [];
      if (parsed.coverDataUrl) {
        book.coverUrl = parsed.coverDataUrl;
      }
    }

    const byteSize = new Blob([processedContent]).size;
    const meta: BookMetadata = {
      id: book.id,
      title: book.title,
      author: book.author,
      epubUrl: book.epubUrl,
      coverUrl: book.coverUrl,
      byteSize
    };

    await saveBookOffline(meta, { metadata: meta, content: processedContent, chapters }, targetSlotIndex);
  } catch (err) {
    console.error('[Zenolet] Failed to download book into slot:', err);
    alert(`Could not download "${book.title}". Please check your internet connection or proxy settings.`);
  } finally {
    loadingSlotState = null;
    update8SlotShelfView();
  }
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
    activeBookChapters = [];

    // 1. Try Offline Cache API first
    const offlineData = await getStoredBookOffline(book.id);
    if (offlineData) {
      processedContent = offlineData.content;
      activeBookChapters = offlineData.chapters || [];
      DOM.readerContent.innerHTML = processedContent;

      // Backfill byteSize if not already stored on shelf slot
      const slotIndexToUpdate = typeof targetSlotIndex === 'number' ? targetSlotIndex : activeSlotIndex;
      if (typeof slotIndexToUpdate === 'number') {
        const slots = getStoredSlots();
        if (slots[slotIndexToUpdate] && !slots[slotIndexToUpdate]?.byteSize) {
          slots[slotIndexToUpdate]!.byteSize = new Blob([processedContent]).size;
          saveSlots(slots);
        }
      }
    } else {
      // Set slot spinner loading state while downloading EPUB
      const slotIndexToLoad = typeof targetSlotIndex === 'number' ? targetSlotIndex : activeSlotIndex;
      if (typeof slotIndexToLoad === 'number') {
        loadingSlotState = {
          slotIndex: slotIndexToLoad,
          book: {
            id: book.id,
            title: book.title,
            author: book.author,
            epubUrl: book.epubUrl,
            coverUrl: book.coverUrl
          }
        };
        update8SlotShelfView();
      }

      try {
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
        activeBookChapters = parsed.chapters || [];
        DOM.readerContent.innerHTML = processedContent;

        const byteSize = new Blob([processedContent]).size;

        // Always auto-save book offline into slot storage upon selection
        const meta: BookMetadata = {
          id: book.id,
          title: book.title,
          author: book.author,
          epubUrl: book.epubUrl,
          coverUrl: parsed.coverDataUrl || book.coverUrl,
          byteSize
        };
        const slotToSave = typeof targetSlotIndex === 'number' ? targetSlotIndex : activeSlotIndex;
        await saveBookOffline(
          meta,
          { metadata: meta, content: processedContent, chapters: activeBookChapters },
          slotToSave
        );
      } finally {
        loadingSlotState = null;
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

    // Ensure all inlined images are decoded before measuring layout dimensions
    const images = Array.from(DOM.readerContent.querySelectorAll('img'));
    if (images.length > 0) {
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalHeight !== 0) return Promise.resolve();
          if (typeof img.decode === 'function') {
            return img.decode().catch(() => {});
          }
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        })
      );
    }

    // Recalculate Columns & Page Spreads without preserving stale DOM scroll or queueing progress=0
    recalculatePages(
      DOM.readerViewport,
      DOM.readerContent,
      DOM.snapPoints,
      DOM.progressFill,
      DOM.pageIndicator,
      readerState,
      book.id,
      false,
      true,
      activeBookChapters
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
  if (activeBook) {
    const progressFraction = getStoredProgressFraction(DOM.readerViewport);
    flushBookProgress(activeBook.id, progressFraction);
  }
  closeChapterPopup();
  invalidateChapterMarkers();
  DOM.readerView.classList.add('hidden');
  DOM.libraryView.classList.remove('hidden');
  readerState.currentView = 'library';
  activeBook = null;
  activeBookChapters = [];
  activeSlotIndex = null;
  DOM.readerViewport.scrollLeft = 0;
  if (window.location.hash) {
    window.history.replaceState({ view: 'library' }, '', window.location.pathname);
  }
  update8SlotShelfView();
}

// --- State & URL Encoding ---
async function updateUrlHashState(pushHistory: boolean = false) {
  if (!activeBook) return;
  const progress = getStoredProgressFraction(DOM.readerViewport);

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
      // If hash is an intra-book anchor target (e.g. #c0_... or short anchor), do not close reader
      if (hash && (hash.startsWith('#c') || hash.length < 40)) {
        return;
      }
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

  activeSlotIndex = null;
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
    setTimeout(() => DOM.aboutClose?.focus(), 50);
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

  // Keyboard Shortcuts (Arrow Left/Right, Space, Modal Focus Traps)
  document.addEventListener('keydown', (e) => {
    const activeModal = [DOM.aboutModal, DOM.qrModal, DOM.discoverPanel, DOM.settingsPanel].find(
      (m) => m && m.classList.contains('visible')
    );

    if (activeModal) {
      if (e.key === 'Escape') {
        DOM.aboutModal?.classList.remove('visible');
        closeQRModal(DOM.qrModal);
        closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel);
        DOM.settingsPanel.classList.remove('visible');
        return;
      }
      if (e.key === 'Tab') {
        const focusable = activeModal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const visibleFocusable = Array.from(focusable).filter(
          (el) => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0
        );
        if (visibleFocusable.length > 0) {
          const first = visibleFocusable[0];
          const last = visibleFocusable[visibleFocusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first || !activeModal.contains(document.activeElement)) {
              e.preventDefault();
              last.focus();
            }
          } else {
            if (document.activeElement === last || !activeModal.contains(document.activeElement)) {
              e.preventDefault();
              first.focus();
            }
          }
        }
      }
      return;
    }

    if (readerState.currentView !== 'reader') return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'ArrowLeft' || (e.key === ' ' && e.shiftKey)) {
      e.preventDefault();
      DOM.readerViewport.scrollBy({ left: -DOM.readerViewport.clientWidth, behavior: 'auto' });
    } else if (e.key === 'ArrowRight' || (e.key === ' ' && !e.shiftKey)) {
      e.preventDefault();
      DOM.readerViewport.scrollBy({ left: DOM.readerViewport.clientWidth, behavior: 'auto' });
    }
  });

  // Intercept links inside book content (TOC chapter links, footnotes, external URLs)
  DOM.readerContent.addEventListener('click', (e: MouseEvent) => {
    const targetLink = (e.target as HTMLElement).closest('a');
    if (!targetLink) return;

    const href = targetLink.getAttribute('href');
    if (!href) return;

    // External links (http:// or https://)
    if (/^https?:\/\//i.test(href)) {
      e.preventDefault();
      e.stopPropagation();
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }

    // Internal book anchor / section links
    e.preventDefault();
    e.stopPropagation();

    const anchorId = href.startsWith('#') ? href.slice(1) : href.includes('#') ? href.split('#')[1] : href;

    if (!anchorId) return;

    const targetEl = resolveChapterElement(DOM.readerContent, anchorId);
    if (targetEl && readerState.totalPagesSpreads > 0) {
      const targetSpread = getElementSpreadIndex(targetEl, DOM.readerViewport, readerState.totalPagesSpreads);
      const pageWidth = DOM.readerViewport.clientWidth;
      if (pageWidth > 0) {
        DOM.readerViewport.scrollTo({
          left: targetSpread * pageWidth,
          behavior: 'smooth'
        });
      }
    }
  });

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
        activeBook.id,
        true,
        false,
        activeBookChapters
      );
    }
  });

  // Window Navigation Listeners (Back/Forward buttons)
  window.addEventListener('hashchange', () => handleUrlHashState());
  window.addEventListener('popstate', () => handleUrlHashState());

  // Flush reading progress immediately on tab switch or page unload
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && activeBook) {
      const progressFraction = getStoredProgressFraction(DOM.readerViewport);
      flushBookProgress(activeBook.id, progressFraction);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (activeBook) {
      const progressFraction = getStoredProgressFraction(DOM.readerViewport);
      flushBookProgress(activeBook.id, progressFraction);
    }
  });
}
