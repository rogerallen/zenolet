import './style.css';
import { loadZenoletConfig, type ZenoletConfig } from './services/config.ts';
import { fetchCatalog } from './services/catalog.ts';
import { loadBookPipeline } from './services/bookLoader.ts';
import { encodeState, decodeState, type AppState } from './services/state.ts';
import {
  getStoredSlots,
  removeBookFromSlot,
  getStoredProgressDetails,
  flushBookProgress,
  getActualStorageUsage,
  formatStorageSummary
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
  clearMeasuredSpreadsCache,
  setReaderParsedChapters,
  type ReaderState,
  type ReaderElements
} from './components/ReaderEngine.ts';
import { setupSettingsModal } from './components/SettingsModal.ts';
import { openQRModal, closeQRModal } from './components/QRModal.ts';
import { openDiscoverPanel, closeDiscoverPanel, renderLocalCatalogResults } from './components/DiscoverModal.ts';
import {
  closeChapterPopup,
  invalidateChapterMarkers,
  resolveChapterElement,
  getElementSpreadIndex
} from './components/Timeline.ts';
import {
  navigateForward,
  navigateBackward,
  handleKeyboardEvent,
  handleContentLinkClick,
  type NavigationOptions
} from './components/Navigation.ts';
import type { CatalogBook } from './types.ts';
import type { EpubChapter, ParsedChapter } from './services/epub.ts';
import {
  computeChapterWeights,
  calculateGlobalProgress,
  findChapterForGlobalProgress,
  type ChapterWeights
} from './services/virtualization.ts';

// --- State ---
let config: ZenoletConfig = {};
let allBooks: CatalogBook[] = [];
let activeBook: CatalogBook | null = null;
let activeBookChapters: EpubChapter[] = [];
let activeParsedChapters: ParsedChapter[] = [];
let activeChapterIndex: number = 0;
let activeChapterWeights: ChapterWeights = { baseFractions: [0], spanFractions: [1] };
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
if (typeof document !== 'undefined' && !import.meta.env.VITEST) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void initApp();
    });
  } else {
    void initApp();
  }
}

function getReaderElements(): ReaderElements {
  return {
    readerViewport: DOM.readerViewport,
    readerContent: DOM.readerContent,
    snapPoints: DOM.snapPoints,
    progressFill: DOM.progressFill,
    pageIndicator: DOM.pageIndicator
  };
}

export async function initApp(): Promise<void> {
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
      recalculatePages(getReaderElements(), readerState, activeBook.id, {
        preserveDOMScroll: true,
        skipSaveProgress: false,
        epubChapters: activeBookChapters
      });
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
    await loadBookPipeline(book, config.proxyUrl, targetSlotIndex);
  } catch (err) {
    console.error('[Zenolet] Failed to download book into slot:', err);
    alert(`Could not download "${book.title}". Please check your internet connection or proxy settings.`);
  } finally {
    loadingSlotState = null;
    update8SlotShelfView();
  }
}

async function mountChapter(
  chapterIndex: number,
  targetSpreadOrKeyword: number | 'last' | 'fraction' | string = 0,
  targetFraction: number = 0,
  skipSaveProgress: boolean = false
): Promise<void> {
  if (!activeBook || activeParsedChapters.length === 0) return;
  const clampedIndex = Math.min(activeParsedChapters.length - 1, Math.max(0, chapterIndex));
  activeChapterIndex = clampedIndex;

  readerState.currentChapterIndex = clampedIndex;
  readerState.totalChapters =
    activeBookChapters && activeBookChapters.length > 0 ? undefined : activeParsedChapters.length;

  // Mount only active chapter HTML
  DOM.readerContent.innerHTML = activeParsedChapters[clampedIndex].htmlContent;

  // Ensure all inlined images in this chapter are decoded before measuring layout dimensions
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

  // Recalculate columns & spreads for mounted chapter
  recalculatePages(getReaderElements(), readerState, activeBook.id, {
    preserveDOMScroll: false,
    skipSaveProgress: true,
    epubChapters: activeBookChapters,
    parsedChapters: activeParsedChapters,
    onJumpToChapter: (chIdx, spread) => handleJumpToChapter(chIdx, spread)
  });

  // Calculate target spread position within this chapter
  let targetSpread: number;
  if (targetSpreadOrKeyword === 'last') {
    targetSpread = Math.max(0, readerState.totalPagesSpreads - 1);
  } else if (targetSpreadOrKeyword === 'fraction') {
    targetSpread = Math.min(
      readerState.totalPagesSpreads - 1,
      Math.max(0, Math.round(targetFraction * (readerState.totalPagesSpreads - 1)))
    );
  } else if (typeof targetSpreadOrKeyword === 'string') {
    const targetEl = resolveChapterElement(DOM.readerContent, targetSpreadOrKeyword);
    if (targetEl && readerState.totalPagesSpreads > 0) {
      targetSpread = getElementSpreadIndex(targetEl, DOM.readerViewport, readerState.totalPagesSpreads);
    } else {
      targetSpread = 0;
    }
  } else {
    targetSpread = Math.min(readerState.totalPagesSpreads - 1, Math.max(0, targetSpreadOrKeyword));
  }

  const pageWidth = DOM.readerViewport.clientWidth;
  DOM.readerViewport.scrollLeft = targetSpread * pageWidth;

  // Compute global reading progress
  const globalProgress = calculateGlobalProgress(
    clampedIndex,
    targetSpread,
    readerState.totalPagesSpreads,
    activeChapterWeights
  );
  readerState.globalProgress = globalProgress;

  updatePaginationIndicator(
    getReaderElements(),
    readerState,
    activeBook.id,
    undefined,
    skipSaveProgress,
    activeParsedChapters
  );
}

async function handleJumpToChapter(
  chapterIndex: number,
  targetSpreadOrFraction?: number | 'last' | string
): Promise<void> {
  if (targetSpreadOrFraction === 'last') {
    await mountChapter(chapterIndex, 'last');
  } else if (typeof targetSpreadOrFraction === 'string') {
    await mountChapter(chapterIndex, targetSpreadOrFraction);
  } else if (typeof targetSpreadOrFraction === 'number' && targetSpreadOrFraction > 0 && targetSpreadOrFraction < 1) {
    await mountChapter(chapterIndex, 'fraction', targetSpreadOrFraction);
  } else if (typeof targetSpreadOrFraction === 'number') {
    await mountChapter(chapterIndex, targetSpreadOrFraction);
  } else {
    await mountChapter(chapterIndex, 0);
  }
  await updateUrlHashState();
}

async function handleNextPage(): Promise<void> {
  if (!activeBook) return;
  navigateForward(DOM.readerViewport, readerState, async () => {
    if (activeChapterIndex < activeParsedChapters.length - 1) {
      await mountChapter(activeChapterIndex + 1, 0);
      await updateUrlHashState();
    }
  });
}

async function handlePrevPage(): Promise<void> {
  if (!activeBook) return;
  navigateBackward(DOM.readerViewport, readerState, async () => {
    if (activeChapterIndex > 0) {
      await mountChapter(activeChapterIndex - 1, 'last');
      await updateUrlHashState();
    }
  });
}

async function openBook(
  book: CatalogBook,
  initialProgressFraction: number | null = null,
  pushHistory: boolean = true,
  targetSlotIndex?: number | null,
  initialChapterIndex?: number | null
) {
  closeChapterPopup();
  invalidateChapterMarkers();
  clearMeasuredSpreadsCache();
  activeBook = book;
  if (typeof targetSlotIndex === 'number') {
    activeSlotIndex = targetSlotIndex;
  }

  DOM.readerBookTitle.textContent = book.title;
  DOM.readerBookAuthor.textContent = `by ${book.author}`;

  try {
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
      const result = await loadBookPipeline(book, config.proxyUrl, slotIndexToLoad);
      activeBookChapters = result.tocChapters || [];
      activeParsedChapters =
        result.chapters && result.chapters.length > 0
          ? result.chapters
          : [
              {
                index: 0,
                id: 'ch-0',
                title: book.title,
                href: '',
                htmlContent: result.content
              }
            ];
      activeChapterWeights = computeChapterWeights(activeParsedChapters);
      setReaderParsedChapters(activeParsedChapters);

      if (result.coverUrl) {
        book.coverUrl = result.coverUrl;
      }
    } finally {
      loadingSlotState = null;
    }

    // Switch View
    DOM.libraryView.classList.add('hidden');
    DOM.readerView.classList.remove('hidden');
    readerState.currentView = 'reader';

    // Update bookshelf 8-slot view
    update8SlotShelfView();

    // Ensure DOM viewport scroll is clean before opening new book
    DOM.readerViewport.scrollLeft = 0;

    // Determine initial chapter index and progress
    let targetChapterIdx = 0;
    let targetSpreadMode: number | 'fraction' = 0;
    let targetFraction = 0;

    if (
      typeof initialChapterIndex === 'number' &&
      initialChapterIndex >= 0 &&
      initialChapterIndex < activeParsedChapters.length
    ) {
      targetChapterIdx = initialChapterIndex;
      targetSpreadMode = 'fraction';
      targetFraction = initialProgressFraction !== null ? initialProgressFraction : 0;
    } else {
      const storedDetails = getStoredProgressDetails(book.id);
      const targetGlobalFraction =
        initialProgressFraction !== null ? initialProgressFraction : (storedDetails?.progressFraction ?? null);

      if (typeof storedDetails?.chapterIndex === 'number' && initialProgressFraction === null) {
        targetChapterIdx = storedDetails.chapterIndex;
        targetSpreadMode = 'fraction';
        targetFraction = storedDetails.chapterProgress ?? 0;
      } else if (targetGlobalFraction !== null && targetGlobalFraction > 0) {
        const found = findChapterForGlobalProgress(targetGlobalFraction, activeChapterWeights);
        targetChapterIdx = found.chapterIndex;
        targetSpreadMode = 'fraction';
        targetFraction = found.chapterFraction;
      }
    }

    await mountChapter(targetChapterIdx, targetSpreadMode, targetFraction, true);

    // Update URL state hash (push new entry if opening book, replace if restored)
    await updateUrlHashState(pushHistory);
  } catch (err) {
    alert(`Failed to load book "${book.title}". Check your connection or CORS proxy settings.`);
    console.error('[Zenolet Reader] Load error:', err);
  }
}

function closeReaderAndReturnToLibrary() {
  if (activeBook) {
    const currentSpread = readerState.currentPageSpread;
    const totalSpreads = readerState.totalPagesSpreads;
    const chapterFrac = totalSpreads > 1 ? currentSpread / (totalSpreads - 1) : 0;
    const globalProgress = calculateGlobalProgress(
      activeChapterIndex,
      currentSpread,
      totalSpreads,
      activeChapterWeights
    );
    flushBookProgress(activeBook.id, globalProgress, activeChapterIndex, chapterFrac);
  }
  closeChapterPopup();
  invalidateChapterMarkers();
  clearMeasuredSpreadsCache();
  setReaderParsedChapters(undefined);
  DOM.readerView.classList.add('hidden');
  DOM.libraryView.classList.remove('hidden');
  readerState.currentView = 'library';
  activeBook = null;
  activeBookChapters = [];
  activeParsedChapters = [];
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
  const currentSpread = readerState.currentPageSpread;
  const totalSpreads = readerState.totalPagesSpreads;
  const chapterProgress = totalSpreads > 1 ? currentSpread / (totalSpreads - 1) : 0;

  const appState: AppState = {
    bookId: activeBook.id,
    chapter: activeChapterIndex,
    progress: parseFloat(chapterProgress.toFixed(4)),
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
  await openBook(book, state.progress, false, null, state.chapter);
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
    handlePrevPage();
  });
  DOM.nextPageBtn.addEventListener('click', () => {
    handleNextPage();
  });

  // Navigation, Keyboard Shortcuts & Modal Focus Traps
  const navOptions: NavigationOptions = {
    modals: {
      aboutModal: DOM.aboutModal,
      qrModal: DOM.qrModal,
      discoverPanel: DOM.discoverPanel,
      discoverOverlay: DOM.discoverOverlay,
      settingsPanel: DOM.settingsPanel,
      onCloseQR: () => closeQRModal(DOM.qrModal),
      onCloseDiscover: () => closeDiscoverPanel(DOM.discoverOverlay, DOM.discoverPanel)
    },
    readerViewport: DOM.readerViewport,
    readerState,
    readerContent: DOM.readerContent,
    onNextChapter: () => handleNextPage(),
    onPrevChapter: () => handlePrevPage()
  };

  document.addEventListener('keydown', (e) => handleKeyboardEvent(e, navOptions));

  // Touch Swipe Boundary Handling on Reader Viewport
  let touchStartX = 0;
  let touchStartY = 0;
  DOM.readerViewport.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    },
    { passive: true }
  );

  DOM.readerViewport.addEventListener(
    'touchend',
    (e: TouchEvent) => {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > 2 * Math.abs(deltaY)) {
          if (deltaX < 0 && readerState.currentPageSpread >= readerState.totalPagesSpreads - 1) {
            handleNextPage();
          } else if (deltaX > 0 && readerState.currentPageSpread === 0) {
            handlePrevPage();
          }
        }
      }
    },
    { passive: true }
  );

  // Intercept links inside book content (TOC chapter links, footnotes, external URLs)
  DOM.readerContent.addEventListener('click', (e: MouseEvent) => {
    handleContentLinkClick(
      e,
      DOM.readerContent,
      DOM.readerViewport,
      readerState,
      async (targetChapterIndex, anchorId) => {
        await mountChapter(targetChapterIndex, 0);
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
        await updateUrlHashState();
      },
      activeParsedChapters
    );
  });

  // Viewport Scroll Listener for Progress Indicator & URL State
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  DOM.readerViewport.addEventListener('scroll', () => {
    if (!activeBook) return;
    const globalProgress = calculateGlobalProgress(
      activeChapterIndex,
      readerState.currentPageSpread,
      readerState.totalPagesSpreads,
      activeChapterWeights
    );
    readerState.globalProgress = globalProgress;
    updatePaginationIndicator(getReaderElements(), readerState, activeBook.id, undefined, false, activeParsedChapters);

    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => updateUrlHashState(), 400);
  });

  // Resize Listener
  window.addEventListener('resize', () => {
    if (activeBook && readerState.currentView === 'reader') {
      clearMeasuredSpreadsCache();
      recalculatePages(getReaderElements(), readerState, activeBook.id, {
        preserveDOMScroll: true,
        skipSaveProgress: false,
        epubChapters: activeBookChapters,
        parsedChapters: activeParsedChapters,
        onJumpToChapter: (chIdx, spread) => handleJumpToChapter(chIdx, spread)
      });
    }
  });

  // Window Navigation Listeners (Back/Forward buttons)
  window.addEventListener('hashchange', () => handleUrlHashState());
  window.addEventListener('popstate', () => handleUrlHashState());

  // Flush reading progress immediately on tab switch or page unload
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && activeBook) {
      const currentSpread = readerState.currentPageSpread;
      const totalSpreads = readerState.totalPagesSpreads;
      const chapterFrac = totalSpreads > 1 ? currentSpread / (totalSpreads - 1) : 0;
      const globalProgress = calculateGlobalProgress(
        activeChapterIndex,
        currentSpread,
        totalSpreads,
        activeChapterWeights
      );
      flushBookProgress(activeBook.id, globalProgress, activeChapterIndex, chapterFrac);
    }
  });

  window.addEventListener('beforeunload', () => {
    if (activeBook) {
      const currentSpread = readerState.currentPageSpread;
      const totalSpreads = readerState.totalPagesSpreads;
      const chapterFrac = totalSpreads > 1 ? currentSpread / (totalSpreads - 1) : 0;
      const globalProgress = calculateGlobalProgress(
        activeChapterIndex,
        currentSpread,
        totalSpreads,
        activeChapterWeights
      );
      flushBookProgress(activeBook.id, globalProgress, activeChapterIndex, chapterFrac);
    }
  });
}

export { readerState, closeReaderAndReturnToLibrary, handleUrlHashState, openBook };
