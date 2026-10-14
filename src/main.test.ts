import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { handleKeyboardEvent, handleContentLinkClick, type NavigationOptions } from './components/Navigation.js';
import type { ReaderState } from './components/ReaderEngine.js';
import { initApp, closeReaderAndReturnToLibrary, readerState as appReaderState } from './main.js';

describe('Zenolet Navigation Keyboard & Link Interception Integration', () => {
  let readerViewport: HTMLDivElement;
  let readerContent: HTMLElement;
  let aboutModal: HTMLDivElement;
  let settingsPanel: HTMLDivElement;
  let discoverPanel: HTMLElement;
  let discoverOverlay: HTMLDivElement;
  let qrModal: HTMLDivElement;
  let readerState: ReaderState;
  let options: NavigationOptions;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app">
        <div id="library-view" class="view"></div>
        <div id="reader-view" class="view hidden">
          <div id="reader-viewport" class="reader-viewport">
            <div id="reader-content" class="reader-content"></div>
          </div>
        </div>
        <div id="about-modal" class="modal-overlay"></div>
        <div id="settings-panel" class="settings-panel"></div>
        <div id="discover-overlay" class="modal-overlay"></div>
        <aside id="discover-panel" class="discover-panel"></aside>
        <div id="qr-modal" class="modal-overlay"></div>
      </div>
    `;

    readerViewport = document.getElementById('reader-viewport') as HTMLDivElement;
    readerContent = document.getElementById('reader-content') as HTMLElement;
    aboutModal = document.getElementById('about-modal') as HTMLDivElement;
    settingsPanel = document.getElementById('settings-panel') as HTMLDivElement;
    discoverPanel = document.getElementById('discover-panel') as HTMLElement;
    discoverOverlay = document.getElementById('discover-overlay') as HTMLDivElement;
    qrModal = document.getElementById('qr-modal') as HTMLDivElement;

    Object.defineProperty(readerViewport, 'clientWidth', { value: 500, configurable: true });
    readerViewport.scrollBy = vi.fn() as unknown as typeof readerViewport.scrollBy;

    readerState = {
      currentView: 'reader',
      theme: 'sepia',
      fontSize: 16,
      layoutColumns: 'auto',
      currentPageSpread: 1,
      totalPagesSpreads: 5
    };

    options = {
      modals: {
        aboutModal,
        settingsPanel,
        discoverPanel,
        discoverOverlay,
        qrModal,
        onCloseDiscover: () => {
          discoverPanel.classList.remove('visible');
          discoverOverlay.classList.remove('visible');
        },
        onCloseQR: () => qrModal.classList.remove('visible')
      },
      readerViewport,
      readerState,
      readerContent
    };
  });

  it('handles Escape key to dismiss all open modals and panels via production handler', () => {
    aboutModal.classList.add('visible');
    settingsPanel.classList.add('visible');
    discoverPanel.classList.add('visible');
    discoverOverlay.classList.add('visible');

    handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'Escape' }), options);

    expect(aboutModal.classList.contains('visible')).toBe(false);
    expect(settingsPanel.classList.contains('visible')).toBe(false);
    expect(discoverPanel.classList.contains('visible')).toBe(false);
    expect(discoverOverlay.classList.contains('visible')).toBe(false);
  });

  it('navigates forward with ArrowRight and Space, and backward with ArrowLeft and Shift+Space via production handler (LATER-002)', () => {
    // 1. ArrowRight -> forward
    handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }), options);
    expect(readerViewport.scrollBy).toHaveBeenLastCalledWith({ left: 500, behavior: 'auto' });

    // 2. Space -> forward
    handleKeyboardEvent(new KeyboardEvent('keydown', { key: ' ', shiftKey: false }), options);
    expect(readerViewport.scrollBy).toHaveBeenLastCalledWith({ left: 500, behavior: 'auto' });

    // 3. ArrowLeft -> backward
    handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }), options);
    expect(readerViewport.scrollBy).toHaveBeenLastCalledWith({ left: -500, behavior: 'auto' });

    // 4. Shift + Space -> backward
    handleKeyboardEvent(new KeyboardEvent('keydown', { key: ' ', shiftKey: true }), options);
    expect(readerViewport.scrollBy).toHaveBeenLastCalledWith({ left: -500, behavior: 'auto' });
  });

  it('intercepts external HTTP links and opens in a new tab safely with noopener noreferrer via production handler', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    readerContent.innerHTML = `<a id="ext-link" href="https://www.gutenberg.org">External Project Gutenberg</a>`;
    const link = document.getElementById('ext-link') as HTMLAnchorElement;

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: link });

    handleContentLinkClick(event, readerContent, readerViewport, readerState);

    expect(windowOpenSpy).toHaveBeenCalledWith('https://www.gutenberg.org', '_blank', 'noopener,noreferrer');
  });

  it('traps Tab and Shift+Tab focus within active modal dialogs via production handler (ACC-001)', () => {
    aboutModal.innerHTML = `
      <div class="modal-card">
        <button id="btn-1">First Button</button>
        <button id="btn-2">Second Button</button>
        <button id="btn-3">Last Button</button>
      </div>
    `;
    aboutModal.classList.add('visible');

    const btn1 = aboutModal.querySelector('#btn-1') as HTMLButtonElement;
    const btn3 = aboutModal.querySelector('#btn-3') as HTMLButtonElement;

    // 1. Tabbing forward from last element wraps to first
    btn3.focus();
    expect(document.activeElement).toBe(btn3);
    handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false }), options);
    expect(document.activeElement).toBe(btn1);

    // 2. Tabbing backward (Shift+Tab) from first element wraps to last
    btn1.focus();
    expect(document.activeElement).toBe(btn1);
    handleKeyboardEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }), options);
    expect(document.activeElement).toBe(btn3);
  });
});

describe('App Lifecycle and Integration (main.ts initApp)', () => {
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  const bodyContent = indexHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || '';

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = bodyContent;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('config.json')) {
        return {
          ok: true,
          json: async () => ({
            title: 'Test Micro-Library',
            curator: { name: 'Curator Alice', linkUrl: 'https://example.com/alice' },
            blurb: 'A curated test library.',
            repoUrl: 'https://github.com/example/repo',
            settings: { defaultTheme: 'sepia', fontSize: 18, layoutColumns: 'auto' }
          })
        } as Response;
      }
      if (url.includes('catalog.json')) {
        return {
          ok: true,
          json: async () => [
            {
              id: '1342',
              title: 'Pride and Prejudice',
              author: 'Jane Austen',
              downloads: 100,
              subjects: ['Fiction']
            }
          ]
        } as Response;
      }
      return { ok: false, status: 404 } as Response;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes application UI, config, bookshelf, and settings successfully', async () => {
    await initApp();

    // 1. Document title updated from config
    expect(document.title).toBe('Test Micro-Library — Zenolet');

    // 2. Curator header rendered
    const curatorContainer = document.getElementById('curator-header-container');
    expect(curatorContainer?.textContent).toContain('Test Micro-Library');
    expect(curatorContainer?.textContent).toContain('Curator Alice');

    // 3. Footer repo link updated
    const footerRepoLink = document.getElementById('footer-repo-link') as HTMLAnchorElement;
    expect(footerRepoLink.href).toBe('https://github.com/example/repo');

    // 4. Bookshelf slots grid rendered with 8 slots
    const slotsGrid = document.getElementById('slots-grid');
    const slotCards = slotsGrid?.querySelectorAll('.slot-card');
    expect(slotCards?.length).toBe(8);

    // 5. Settings applied
    expect(appReaderState.theme).toBe('sepia');
    expect(appReaderState.fontSize).toBe(18);
    expect(appReaderState.layoutColumns).toBe('auto');

    // 6. Storage summary rendered
    await vi.waitFor(() => {
      const storageStatus = document.getElementById('library-storage-status');
      expect(storageStatus?.textContent).toContain('0 books, 0 MB used');
    });
  });

  it('toggles About modal open and close via click events', async () => {
    await initApp();

    const aboutToggle = document.getElementById('about-toggle') as HTMLButtonElement;
    const aboutModal = document.getElementById('about-modal') as HTMLDivElement;
    const aboutClose = document.getElementById('about-close') as HTMLButtonElement;

    expect(aboutModal.classList.contains('visible')).toBe(false);

    aboutToggle.click();
    expect(aboutModal.classList.contains('visible')).toBe(true);

    aboutClose.click();
    expect(aboutModal.classList.contains('visible')).toBe(false);

    // Clicking outside modal content also dismisses
    aboutToggle.click();
    expect(aboutModal.classList.contains('visible')).toBe(true);
    aboutModal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(aboutModal.classList.contains('visible')).toBe(false);
  });

  it('returns cleanly to library view from reader view on closeReaderAndReturnToLibrary', async () => {
    await initApp();

    const libraryView = document.getElementById('library-view') as HTMLDivElement;
    const readerView = document.getElementById('reader-view') as HTMLDivElement;

    // Simulate being in reader view
    appReaderState.currentView = 'reader';
    readerView.classList.remove('hidden');
    libraryView.classList.add('hidden');

    closeReaderAndReturnToLibrary();

    expect(readerView.classList.contains('hidden')).toBe(true);
    expect(libraryView.classList.contains('hidden')).toBe(false);
    expect(appReaderState.currentView).toBe('library');
  });

  it('triggers closeReaderAndReturnToLibrary when back button is clicked', async () => {
    await initApp();

    const backButton = document.getElementById('back-button') as HTMLButtonElement;
    const libraryView = document.getElementById('library-view') as HTMLDivElement;
    const readerView = document.getElementById('reader-view') as HTMLDivElement;

    // Simulate being in reader view
    appReaderState.currentView = 'reader';
    readerView.classList.remove('hidden');
    libraryView.classList.add('hidden');

    backButton.click();

    expect(readerView.classList.contains('hidden')).toBe(true);
    expect(libraryView.classList.contains('hidden')).toBe(false);
    expect(appReaderState.currentView).toBe('library');
  });

  it('closes QR modal when close button or outside backdrop is clicked', async () => {
    await initApp();

    const qrModal = document.getElementById('qr-modal') as HTMLDivElement;
    const qrClose = document.getElementById('qr-close') as HTMLButtonElement;

    qrModal.classList.add('visible');
    qrClose.click();
    expect(qrModal.classList.contains('visible')).toBe(false);

    qrModal.classList.add('visible');
    qrModal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(qrModal.classList.contains('visible')).toBe(false);
  });

  it('closes discover modal when close button or overlay is clicked', async () => {
    await initApp();

    const discoverOverlay = document.getElementById('discover-overlay') as HTMLDivElement;
    const discoverPanel = document.getElementById('discover-panel') as HTMLElement;
    const discoverClose = document.getElementById('discover-close') as HTMLButtonElement;

    discoverOverlay.classList.add('visible');
    discoverPanel.classList.add('visible');
    discoverClose.click();
    expect(discoverOverlay.classList.contains('visible')).toBe(false);
    expect(discoverPanel.classList.contains('visible')).toBe(false);

    discoverOverlay.classList.add('visible');
    discoverPanel.classList.add('visible');
    discoverOverlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(discoverOverlay.classList.contains('visible')).toBe(false);
    expect(discoverPanel.classList.contains('visible')).toBe(false);
  });

  it('filters catalog search results on search input event', async () => {
    await initApp();

    const searchInput = document.getElementById('discover-search-input') as HTMLInputElement;
    const discoverResults = document.getElementById('discover-results') as HTMLDivElement;

    searchInput.value = 'Pride';
    searchInput.dispatchEvent(new Event('input'));

    expect(discoverResults.innerHTML).toContain('Pride and Prejudice');
  });

  it('handles hashchange to return to library when state hash is removed', async () => {
    await initApp();

    const libraryView = document.getElementById('library-view') as HTMLDivElement;
    const readerView = document.getElementById('reader-view') as HTMLDivElement;

    appReaderState.currentView = 'reader';
    readerView.classList.remove('hidden');
    libraryView.classList.add('hidden');

    window.location.hash = '';
    window.dispatchEvent(new Event('hashchange'));

    expect(readerView.classList.contains('hidden')).toBe(true);
    expect(libraryView.classList.contains('hidden')).toBe(false);
  });

  it('preserves reader view when hashchange is an intra-book anchor', async () => {
    await initApp();

    const libraryView = document.getElementById('library-view') as HTMLDivElement;
    const readerView = document.getElementById('reader-view') as HTMLDivElement;

    appReaderState.currentView = 'reader';
    readerView.classList.remove('hidden');
    libraryView.classList.add('hidden');

    window.location.hash = '#c0_sec1';
    window.dispatchEvent(new Event('hashchange'));

    expect(appReaderState.currentView).toBe('reader');
    expect(readerView.classList.contains('hidden')).toBe(false);
  });

  it('prevents default on dblclick for next and prev navigation buttons to prevent Safari smart-zoom', async () => {
    await initApp();

    const prevBtn = document.getElementById('prev-page-btn') as HTMLButtonElement;
    const nextBtn = document.getElementById('next-page-btn') as HTMLButtonElement;

    const prevDblClick = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
    prevBtn.dispatchEvent(prevDblClick);
    expect(prevDblClick.defaultPrevented).toBe(true);

    const nextDblClick = new MouseEvent('dblclick', { bubbles: true, cancelable: true });
    nextBtn.dispatchEvent(nextDblClick);
    expect(nextDblClick.defaultPrevented).toBe(true);
  });
});
