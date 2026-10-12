import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleKeyboardEvent, handleContentLinkClick, type NavigationOptions } from './components/Navigation.js';
import type { ReaderState } from './components/ReaderEngine.js';

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
